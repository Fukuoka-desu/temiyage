#!/usr/bin/env python3
"""CSVを列名で読み、元の値を変更せず表示用JSONを生成する。"""
import csv
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'src/data/items.json'


def number(value):
    value = value.strip()
    return int(float(value)) if re.fullmatch(r'[0-9]+(?:\.[0-9]+)?', value) else None


def display_url(value):
    value = value.split('|', 1)[0].strip()
    if re.search(r'\s', value):
        return ''
    try:
        parsed = urlsplit(value)
        return value if parsed.scheme.lower() in {'http', 'https'} and parsed.netloc else ''
    except ValueError:
        return ''


def convert(row, item_id):
    def get(key):
        return row.get(key, '') or ''

    store = get('要冷蔵/冷凍').strip()
    storage_label = ''
    if re.match(r'^(要)?冷凍', store):
        storage_label = '冷凍'
    elif re.match(r'^(要)?冷蔵|^そば:冷蔵', store):
        storage_label = '要冷蔵'
    elif re.search(r'クール便|冷蔵便|冷蔵配送|暑い地域は冷蔵', store):
        storage_label = '夏季クール便'
    tags = [tag for tag in get('好みタグ').split(',') if tag]
    status = get('確認状態') if '確認状態' in row else get('判定')
    return {
        'id': item_id,
        'r': get('地方'),
        'p': get('都道府県'),
        'n': get('品名'),
        'q': get('内容量'),
        'm': get('メーカー'),
        'y': number(get('税込価格(円)')),
        'd': number(get('日持ち(日)')),
        'dr': get('日持ち(原文)'),
        'st': storage_label,
        'sr': store,
        'ko': get('個包装') == '有' or '個包装' in tags,
        'g': get('ジャンル'),
        't': tags,
        'u': display_url(get('出典URL')),
        'src': get('出典の種類'),
        'c': get('確認日'),
        'v': status.strip() == '確認済み',
        'vr': get('検査結果'),
    }


def main():
    from source_csv import source_csv
    source_path = source_csv(sys.argv[1] if len(sys.argv) > 1 else None)
    with source_path.open(encoding='utf-8-sig', newline='') as source:
        items = [convert(row, index) for index, row in enumerate(csv.DictReader(source), 1)]
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(items, ensure_ascii=False, separators=(',', ':')) + '\n',
        encoding='utf-8',
    )
    print(f'{len(items)} items, {sum(item["v"] for item in items)} verified -> {OUTPUT}')


if __name__ == '__main__':
    main()
