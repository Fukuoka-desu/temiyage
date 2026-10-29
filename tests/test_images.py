import csv
import io
from http.client import InvalidURL
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts.fetch_images import (
    COLUMNS, MAX_BYTES, Fetcher, Network, common_images, decode_html,
    extract_image, host_jobs, make_rows, write_outputs,
)


class Response(io.BytesIO):
    def __init__(self, status=200, headers=None, body=b''):
        super().__init__(body)
        self.code = status
        self.headers = headers or {}


class ImageTests(unittest.TestCase):
    def test_meta_priority_and_relative(self):
        html = '<meta name="twitter:image" content="/twitter.jpg"><meta property="og:image" content="../photo.jpg">'
        self.assertEqual(extract_image(html, 'https://shop.test/p/item'), ('https://shop.test/photo.jpg', 'og:image'))
        for key, origin in [('og:image:secure_url', 'og:image'), ('twitter:image', 'twitter:image'), ('twitter:image:src', 'twitter:image')]:
            self.assertEqual(extract_image(f'<meta property="{key}" content="//cdn.test/a.jpg">', 'https://shop.test'), ('https://cdn.test/a.jpg', origin))
        self.assertEqual(extract_image('<meta property="og:image" content="data:image/png;base64,x">', 'https://shop.test')[0], '')
        self.assertEqual(extract_image('<p>none</p>', 'https://shop.test')[1], '画像タグなし')

    def test_image_url_encoding_and_csv(self):
        raw = '/uploads/390004 三割九分 720ml/写真%20-small.jpg?q=日本 語&size=small'
        expected = 'https://shop.test/uploads/390004%20%E4%B8%89%E5%89%B2%E4%B9%9D%E5%88%86%20720ml/%E5%86%99%E7%9C%9F%20-small.jpg?q=%E6%97%A5%E6%9C%AC%20%E8%AA%9E&size=small'
        page = 'https://shop.test/page'
        image, origin = extract_image(f'<meta property="og:image" content="{raw}">', page)
        self.assertEqual(image, expected)
        self.assertEqual(extract_image(f'<meta property="og:image" content="{image}">', page)[0], expected)
        rows = make_rows([{'id': 1, 'n': '品', 'u': page}], {page: (image, origin)}, {})
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]) as directory:
            with patch('sys.stdout', new_callable=io.StringIO):
                write_outputs(rows, directory)
            with open(Path(directory) / 'item_images.csv', encoding='utf-8', newline='') as handle:
                self.assertEqual(list(csv.reader(handle))[1][3], expected)

    def test_job_exceptions_preserve_other_rows(self):
        items = [{'id': i, 'n': str(i), 'u': f'https://shop.test/{i}'} for i in range(1, 4)]
        class FakeFetcher:
            def page(self, url):
                if url.endswith('/1'):
                    raise RuntimeError('broken page')
                return url + '.jpg', 'og:image'

            def image(self, url):
                if url.endswith('/2.jpg'):
                    raise InvalidURL('broken image')
                return ''

        fetcher = FakeFetcher()
        with patch('sys.stderr', new_callable=io.StringIO):
            pages = host_jobs([item['u'] for item in items], fetcher.page,
                              lambda name: ('', f'ページ取得失敗({name})'))
            checks = host_jobs([image for image, _ in pages.values() if image], fetcher.image,
                               lambda name: f'画像を開けない({name})')
        rows = make_rows(items, pages, checks)
        self.assertEqual([row[-1] for row in rows], [
            'ページ取得失敗(RuntimeError)', '画像を開けない(InvalidURL)', 'og:image',
        ])
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]) as directory:
            with patch('sys.stdout', new_callable=io.StringIO):
                write_outputs(rows, directory)
            with open(Path(directory) / 'item_images.csv', encoding='utf-8', newline='') as handle:
                output = list(csv.reader(handle))
        self.assertEqual(len(output), 4)
        self.assertEqual(output[-1][3:5], ['https://shop.test/3.jpg', '取得'])

    def test_jsonld(self):
        for value in ['pic.jpg', ['pic.jpg'], {'@type': 'ImageObject', 'url': 'pic.jpg'}, [{'url': 'pic.jpg'}]]:
            product = {'@type': ['Thing', 'Product'], 'image': value}
            for document in [product, [product], {'@graph': [product]}]:
                html = '<script type="application/ld+json">' + json.dumps(document) + '</script>'
                self.assertEqual(extract_image(html, 'https://shop.test/item'), ('https://shop.test/pic.jpg', 'JSON-LD'))

    def test_names(self):
        from scripts.fetch_images import rejected_name
        for name in ['LOGO.jpg', 'ogp_default.png', 'og_default.png', 'default.png', 'noimage.jpg', 'no_image.jpg', 'no-image.jpg', 'common/a.jpg', 'share.jpg', 'sns.jpg', 'favicon.ico', 'icon.png', 'banner.jpg', 'TOP.webp', '%6cogo.jpg', 'ogp.jpg', 'itemOGP123.jpg', 'OG_IMG.png', 'og-image.jpg', 'ogimage.jpg', 'og_image.jpg', 'Thumbnail.webp']:
            self.assertTrue(rejected_name('https://shop.test/' + name), name)
        self.assertFalse(rejected_name('https://shop.test/product.jpg?share=yes&ogp=yes'))
        self.assertFalse(rejected_name('https://shop.test/ogp/thumbnail/product.jpg'))

    def test_common_and_rows(self):
        image = 'https://shop.test/product.jpg'
        items = [{'id': 2, 'n': 'B', 'u': 'https://shop.test/a'}, {'id': 1, 'n': 'A', 'u': 'https://shop.test/a'}]
        pages = {'https://shop.test/a': (image, 'og:image')}
        self.assertEqual(common_images(items, pages), {image: 2})
        rows = make_rows(items, pages, {})
        self.assertEqual([row[0] for row in rows], [1, 2])
        self.assertTrue(all(row[3:] == ['', '取れなかった', '複数の品で共通(2件)'] for row in rows))
        pages['https://shop.test/b'] = (image, 'JSON-LD')
        self.assertEqual(common_images(items, pages), {image: 2})
        self.assertEqual(make_rows(items, pages, {})[0][3:], ['', '取れなかった', '複数の品で共通(2件)'])
        items.append({'id': 3, 'n': 'C', 'u': 'https://shop.test/b'})
        pages['https://shop.test/b'] = (image + '?size=large', 'JSON-LD')
        pages['https://shop.test/a'] = (image + '?size=small', 'og:image')
        self.assertEqual(common_images(items, pages), {image: 3})
        self.assertTrue(all(row[3:] == ['', '取れなかった', '複数の品で共通(3件)']
                            for row in make_rows(items, pages, {})))
        self.assertEqual(common_images(items[:1], pages), {})
        self.assertEqual(make_rows(items[:1], pages, {})[0][4], '取得')
        pages['https://shop.test/a'] = ('https://shop.test/img/usr/ogp.jpg', 'og:image')
        self.assertEqual(make_rows(items[:1], pages, {})[0][3:],
                         ['', '取れなかった', 'ロゴ・共通画像名(ogp)'])
        self.assertEqual(make_rows([{'id': 3, 'n': 'C', 'u': ''}], {}, {})[0][-1], '出典URLなし')

    def test_csv(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]) as directory:
            with patch('sys.stdout', new_callable=io.StringIO):
                write_outputs([[1, '品,名', '', '', '取れなかった', '出典URLなし']], directory)
            with open(Path(directory) / 'item_images.csv', encoding='utf-8', newline='') as handle:
                rows = list(csv.reader(handle))
            self.assertEqual(rows[0], COLUMNS)
            self.assertEqual(rows[1][1], '品,名')
            self.assertIn('出典URLなし: 1件', (Path(directory) / 'summary.md').read_text())

    def test_decode(self):
        html = '<meta charset="shift_jis">商品'
        self.assertEqual(decode_html(html.encode('shift_jis'), ''), html)
        self.assertIn('\ufffd', decode_html(b'\xff', 'charset=invalid'))

    def test_transport_rate_redirect_retry_and_cap(self):
        now = [0]
        calls = []
        responses = iter([Response(302, {'Location': '/next'}), Response(503), Response(body=b'x' * (MAX_BYTES + 10))])
        class Opener:
            def open(self, request, timeout):
                calls.append((request.full_url, now[0], timeout))
                return next(responses)
        network = Network(Opener(), clock=lambda: now[0], sleep=lambda seconds: now.__setitem__(0, now[0] + seconds))
        result = network.request('https://shop.test/start')
        self.assertEqual(len(result[2]), MAX_BYTES)
        self.assertEqual([call[1] for call in calls], [0, 2.5, 32.5])
        self.assertEqual(calls[-1][0], 'https://shop.test/next')
        self.assertTrue(all(call[2] == 15 for call in calls))

    def test_cache_and_image_fallback(self):
        class FakeNetwork:
            def __init__(self):
                self.calls = []
            def request(self, url, method='GET', headers=None, **kwargs):
                self.calls.append((url, method, headers))
                if url.endswith('/page'):
                    return 200, {}, b'<meta property="og:image" content="/pic.jpg">', url
                if method == 'HEAD':
                    raise TimeoutError()
                return 206, {'Content-Type': 'image/jpeg'}, b'x', url
        network = FakeNetwork()
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]) as directory:
            fetcher = Fetcher(directory, network=network)
            expected = fetcher.page('https://shop.test/page')
            self.assertEqual(Fetcher(directory, True, network).page('https://shop.test/page'), expected)
            self.assertEqual(len(network.calls), 1)
            self.assertEqual(fetcher.image(expected[0]), '')
            self.assertEqual(network.calls[-1][2], {'Range': 'bytes=0-0'})

    def test_http_image_https_check_and_csv(self):
        image = 'http://shop.test/photo.jpg?q=%E6%97%A5'
        secure = image.replace('http:', 'https:', 1)
        page = 'https://shop.test/page'
        for head_status in (200, 403, 405, 500):
            with self.subTest(head_status=head_status):
                calls = []
                class FakeNetwork:
                    def request(self, url, method='GET', headers=None, **kwargs):
                        calls.append((url, method, headers, kwargs))
                        return (head_status if method == 'HEAD' else 206), {'Content-Type': 'image/jpeg'}, b'', url
                fetcher = Fetcher('.', network=FakeNetwork())
                reason = fetcher.image(image)
                self.assertEqual(reason, '')
                self.assertTrue(all(call[0] == secure for call in calls))
                self.assertEqual(len(calls), 1 if head_status == 200 else 2)
                if head_status != 200:
                    self.assertEqual(calls[-1][2:], ({'Range': 'bytes=0-0'}, {'read_limit': 1}))
                rows = make_rows([{'id': 1, 'n': '品', 'u': page}],
                                 {page: (image, 'og:image')}, {image: reason})
                self.assertEqual(rows[0][3:5], [secure, '取得'])
                with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]) as directory:
                    with patch('sys.stdout', new_callable=io.StringIO):
                        write_outputs(rows, directory)
                    with open(Path(directory) / 'item_images.csv', encoding='utf-8', newline='') as handle:
                        self.assertEqual(list(csv.reader(handle))[1][3], secure)

    def test_http_image_https_unavailable(self):
        image = 'http://shop.test/photo.jpg'
        for outcome in ('status', 'timeout', 'downgrade'):
            with self.subTest(outcome=outcome):
                calls = []
                class FakeNetwork:
                    def request(self, url, method='GET', headers=None, **kwargs):
                        calls.append((url, method))
                        if outcome == 'timeout':
                            raise TimeoutError()
                        if outcome == 'downgrade':
                            return 200, {'Content-Type': 'image/jpeg'}, b'', image
                        return 500, {}, b'', url
                reason = Fetcher('.', network=FakeNetwork()).image(image)
                self.assertEqual(reason, 'httpのみ（https不可）')
                self.assertEqual(calls, [(image.replace('http:', 'https:', 1), method) for method in ('HEAD', 'GET')])
                page = 'https://shop.test/page'
                row = make_rows([{'id': 1, 'n': '品', 'u': page}],
                                {page: (image, 'og:image')}, {image: reason})[0]
                self.assertEqual(row[3:], ['', '取れなかった', reason])

    def test_non_ascii_page_and_redirect_urls(self):
        calls = []
        responses = iter([
            Response(302, {'Location': '/商品%20名?q=日本 語'}),
            Response(body=b'<meta property="og:image" content="photo.jpg">'),
        ])
        class Opener:
            def open(self, request, timeout):
                request.full_url.encode('ascii')
                calls.append(request.full_url)
                return next(responses)
        network = Network(Opener(), sleep=lambda seconds: None)
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]) as directory:
            result = Fetcher(directory, network=network).page('https://shop.test/入口%20page')
        self.assertEqual(calls, [
            'https://shop.test/%E5%85%A5%E5%8F%A3%20page',
            'https://shop.test/%E5%95%86%E5%93%81%20%E5%90%8D?q=%E6%97%A5%E6%9C%AC%20%E8%AA%9E',
        ])
        self.assertEqual(result, ('https://shop.test/photo.jpg', 'og:image'))

    def test_failures(self):
        class FakeNetwork:
            def request(self, *args, **kwargs):
                return 403, {}, b'', args[0]
        fetcher = Fetcher('.', network=FakeNetwork())
        self.assertEqual(fetcher.page('https://shop.test'), ('', 'ページ取得失敗(403)'))
        self.assertEqual(fetcher.image('https://shop.test/a'), '画像を開けない(403)')

    def test_all_items_have_one_sorted_row(self):
        root = Path(__file__).resolve().parents[1]
        items = json.loads((root / 'src/data/items.json').read_text())
        rows = make_rows(items, {}, {})
        self.assertEqual(len(rows), 941)
        self.assertEqual([row[0] for row in rows], sorted(item['id'] for item in items))

    def test_html_and_timeout_are_rejected(self):
        class FakeNetwork:
            def request(self, *args, **kwargs):
                return 200, {'Content-Type': 'text/html'}, b'<html>', args[0]
        fetcher = Fetcher('.', network=FakeNetwork())
        self.assertEqual(fetcher.image('https://shop.test/a'), '画像を開けない(Content-Type非画像)')
        with patch.object(fetcher.network, 'request', side_effect=TimeoutError()):
            self.assertEqual(fetcher.image('https://shop.test/a'), '画像を開けない(timeout)')
            self.assertEqual(fetcher.page('https://shop.test/a'), ('', 'ページ取得失敗(timeout)'))


if __name__ == '__main__':
    unittest.main()
