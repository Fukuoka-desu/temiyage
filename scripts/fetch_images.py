#!/usr/bin/env python3
"""Fetch product image metadata; standard library only, no source-data writes."""
import argparse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
import csv
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import socket
import sys
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit, unquote
from urllib.request import Request, build_opener, HTTPRedirectHandler

ROOT = Path(__file__).resolve().parents[1]
COLUMNS = ['id', '品名', '出典ページ', '画像URL', '取得結果', '理由']
MAX_BYTES = 2 * 1024 * 1024
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'


class Metadata(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.meta = defaultdict(list)
        self.scripts = []
        self.script = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'meta':
            self.meta[(a.get('property') or a.get('name') or '').lower()].append(a.get('content', ''))
        if tag == 'script' and a.get('type', '').lower().split(';')[0].strip() == 'application/ld+json':
            self.script = []

    def handle_data(self, data):
        if self.script is not None:
            self.script.append(data)

    def handle_endtag(self, tag):
        if tag == 'script' and self.script is not None:
            self.scripts.append(''.join(self.script))
            self.script = None


def product_images(value):
    if isinstance(value, list):
        for entry in value:
            yield from product_images(entry)
    elif isinstance(value, dict):
        types = value.get('@type', [])
        if isinstance(types, str):
            types = [types]
        if any(t.rsplit('/', 1)[-1] == 'Product' for t in types if isinstance(t, str)):
            yield from image_values(value.get('image'))
        for child in value.values():
            if isinstance(child, (dict, list)):
                yield from product_images(child)


def image_values(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for child in value:
            yield from image_values(child)
    elif isinstance(value, dict):
        yield from image_values(value.get('url'))


def extract_image(html, page_url):
    parser = Metadata()
    parser.feed(html)
    candidates = []
    for key in ('og:image', 'og:image:secure_url', 'twitter:image', 'twitter:image:src'):
        candidates.extend((v, 'og:image' if key.startswith('og:') else 'twitter:image') for v in parser.meta[key])
    for script in parser.scripts:
        try:
            candidates.extend((v, 'JSON-LD') for v in product_images(json.loads(script)))
        except (ValueError, TypeError):
            continue
    for value, origin in candidates:
        url = urljoin(page_url, value.strip())
        if value.strip() and urlsplit(url).scheme.lower() in ('http', 'https') and urlsplit(url).hostname:
            return url, origin
    return '', '画像タグなし'


def rejected_name(url):
    path = unquote(urlsplit(url).path).lower()
    for word in ('logo', 'ogp_default', 'og_default', 'default', 'noimage', 'no_image', 'no-image', 'common', 'share', 'sns', 'favicon', 'icon', 'banner'):
        if word in path:
            return f'ロゴ・共通画像名({word})'
    if re.match(r'^top\.', path.rsplit('/', 1)[-1]):
        return 'ロゴ・共通画像名(top)'
    return ''


def common_images(pages):
    """pages maps distinct source URLs to (image URL, origin/reason)."""
    owners = defaultdict(set)
    for page, (url, _) in pages.items():
        if url:
            owners[url].add(page)
    return {url: len(values) for url, values in owners.items() if len(values) >= 2}


def decode_html(body, content_type):
    head = body[:8192].decode('ascii', errors='ignore')
    encodings = re.findall(r'charset\s*=\s*[\"\']?\s*([\w.-]+)', content_type)
    encodings += re.findall(r'charset\s*=\s*[\"\']?\s*([\w.-]+)', head, re.I)
    for encoding in encodings + ['utf-8']:
        try:
            return body.decode(encoding)
        except (LookupError, UnicodeError):
            pass
    return body.decode('utf-8', errors='replace')


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Network:
    """Inject opener, clock and sleep for offline transport tests."""
    def __init__(self, opener=None, clock=time.monotonic, sleep=time.sleep):
        self.opener = opener or build_opener(NoRedirect())
        self.clock, self.sleep = clock, sleep
        self.guard = threading.Lock()
        self.hosts = {}
        self.slots = threading.Semaphore(6)

    def request(self, url, method='GET', headers=None, read_limit=MAX_BYTES):
        retries = 0
        redirects = 0
        while True:
            if urlsplit(url).scheme not in ('http', 'https'):
                raise ValueError('unsupported URL')
            host = urlsplit(url).hostname
            with self.guard:
                lock, last = self.hosts.setdefault(host, (threading.Lock(), [None]))
            with lock:
                if last[0] is not None:
                    self.sleep(max(0, 2.5 - (self.clock() - last[0])))
                with self.slots:
                    last[0] = self.clock()
                    try:
                        response = self.opener.open(Request(url, method=method, headers={'User-Agent': UA, **(headers or {})}), timeout=15)
                    except HTTPError as exc:
                        response = exc
                    with response:
                        status = response.code
                        response_headers = response.headers
                        body = response.read(read_limit) if method != 'HEAD' and status in (200, 206) else b''
            if status in (301, 302, 303, 307, 308) and response_headers.get('Location'):
                redirects += 1
                if redirects > 10:
                    raise ValueError('redirect limit')
                url = urljoin(url, response_headers['Location'])
                continue
            if status in (429, 503) and retries == 0:
                retries += 1
                self.sleep(30)
                continue
            return status, response_headers, body, url


def error_label(exc):
    if isinstance(exc, (TimeoutError, socket.timeout)) or isinstance(getattr(exc, 'reason', None), (TimeoutError, socket.timeout)):
        return 'timeout'
    return str(getattr(exc, 'code', None) or getattr(exc, 'reason', None) or exc)


class Fetcher:
    def __init__(self, cache, resume=False, network=None):
        self.cache = Path(cache)
        self.resume = resume
        self.network = network or Network()

    def page(self, url):
        cache = self.cache / (hashlib.sha256(url.encode()).hexdigest() + '.json')
        try:
            if self.resume and cache.exists():
                saved = json.loads(cache.read_text(encoding='utf-8'))
            else:
                status, headers, body, final = self.network.request(url)
                if status != 200:
                    return '', f'ページ取得失敗({status})'
                saved = {'url': final, 'html': decode_html(body, headers.get('Content-Type', ''))}
                self.cache.mkdir(parents=True, exist_ok=True)
                cache.write_text(json.dumps(saved, ensure_ascii=False), encoding='utf-8')
            return extract_image(saved['html'], saved['url'])
        except (OSError, ValueError, URLError) as exc:
            return '', f'ページ取得失敗({error_label(exc)})'

    def image(self, url):
        last = 'unknown'
        for method in ('HEAD', 'GET'):
            try:
                status, headers, _, _ = self.network.request(url, method, {'Range': 'bytes=0-0'} if method == 'GET' else {}, read_limit=1)
                if status in (200, 206) and headers.get('Content-Type', '').lower().startswith('image/'):
                    return ''
                last = str(status) if status not in (200, 206) else 'Content-Type非画像'
            except (OSError, ValueError, URLError) as exc:
                last = error_label(exc)
        return f'画像を開けない({last})'


def host_jobs(urls, operation):
    queues = defaultdict(list)
    for url in urls:
        queues[urlsplit(url).hostname].append(url)
    def run(queue):
        return [(url, operation(url)) for url in queue]
    results = {}
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = [executor.submit(run, queue) for queue in queues.values()]
        for future in as_completed(futures):
            results.update(future.result())
            print(f'進捗: {len(results)}/{len(urls)} URL', file=sys.stderr)
    return results


def make_rows(items, pages, checks):
    common = common_images(pages)
    rows = []
    for item in sorted(items, key=lambda x: int(x['id'])):
        page = source_url(item)
        image, origin = pages.get(page, ('', '出典URLなし'))
        reason = origin if not image else rejected_name(image)
        if image and not reason and image in common:
            reason = f'複数ページで共通({common[image]}件)'
        if image and not reason:
            reason = checks.get(image, '')
        ok = bool(image) and not reason
        rows.append([item['id'], item['n'], page, image if ok else '', '取得' if ok else '取れなかった', origin if ok else reason])
    return rows


def source_url(item):
    value = item.get('u') or ''
    if isinstance(value, list):
        return value[0].strip() if value else ''
    return value.split()[0] if value.strip() else ''


def write_outputs(rows, directory):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    with (directory / 'item_images.csv').open('w', encoding='utf-8', newline='') as handle:
        writer = csv.writer(handle)
        writer.writerow(COLUMNS)
        writer.writerows(rows)
    counts = Counter(row[4] for row in rows)
    reasons = Counter(row[5] for row in rows if row[4] == '取れなかった')
    summary = f'# 商品画像取得結果\n\n対象: {len(rows)}件\n\n取得: {counts["取得"]}件\n\n取れなかった: {counts["取れなかった"]}件\n\n'
    summary += '\n'.join(f'- {reason}: {count}件' for reason, count in sorted(reasons.items())) + '\n'
    (directory / 'summary.md').write_text(summary, encoding='utf-8')
    print(summary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--limit', type=int)
    parser.add_argument('--only-ids', help='Comma-separated item IDs')
    args = parser.parse_args()
    if args.limit is not None and args.limit < 0:
        parser.error('--limit must be nonnegative')
    items = sorted(json.loads((ROOT / 'src/data/items.json').read_text(encoding='utf-8')), key=lambda x: int(x['id']))
    if args.only_ids:
        try:
            ids = {int(value) for value in args.only_ids.split(',')}
        except ValueError:
            parser.error('--only-ids must contain integer IDs')
        items = [item for item in items if int(item['id']) in ids]
    if args.limit is not None:
        items = items[:args.limit]
    fetcher = Fetcher(ROOT / 'data/images/cache', args.resume)
    pages = host_jobs(sorted({source_url(item) for item in items if source_url(item)}), fetcher.page)
    common = common_images(pages)
    urls = sorted({image for image, _ in pages.values() if image and not rejected_name(image) and image not in common})
    checks = host_jobs(urls, fetcher.image)
    write_outputs(make_rows(items, pages, checks), ROOT / 'data/images')


if __name__ == '__main__':
    main()
