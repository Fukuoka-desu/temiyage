import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    'build_data', Path(__file__).resolve().parents[1] / 'scripts/build_data.py'
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class DataTests(unittest.TestCase):
    def test_columns_and_status(self):
        row = {'余分な列': '保持不要', '判定': '確認済み', '品名': '品'}
        self.assertTrue(module.convert(row, 1)['v'])
        row['確認状態'] = ''
        self.assertFalse(module.convert(row, 1)['v'])
        row['確認状態'] = '確認済み'
        self.assertTrue(module.convert(row, 1)['v'])
        self.assertEqual(module.convert({}, 2)['u'], '')
        self.assertIsNone(module.convert({}, 2)['y'])
        self.assertEqual(row['判定'], '確認済み')

    def test_display_url(self):
        for value in ['', '不明', 'ftp://example.com', 'javascript:alert(1)', 'https://']:
            self.assertEqual(module.display_url(value), '')
        self.assertEqual(module.display_url('https://example.com/a'), 'https://example.com/a')

    def test_multiple_real_urls(self):
        import csv
        with (Path(__file__).resolve().parents[1] / 'data/source/temiyage_master.csv').open(encoding='utf-8-sig') as source:
            rows = list(csv.DictReader(source))
        multiple = [r for r in rows if '|' in r.get('出典URL', '')]
        self.assertGreaterEqual(len(multiple), 3)
        for row in multiple[:3]:
            self.assertEqual(module.convert(row, 1)['u'], row['出典URL'].split('|')[0].strip())
        self.assertEqual(module.display_url('不明 | https://example.com'), '')

    def test_image_enrichment_preserves_original_fields(self):
        import csv
        import copy
        from tempfile import TemporaryDirectory
        with TemporaryDirectory(dir=Path(__file__).resolve().parents[1]) as directory:
            path = Path(directory) / 'images.csv'
            items = [module.convert({'品名': '品'}, 1), module.convert({'品名': '別'}, 2)]
            before = copy.deepcopy(items)
            module.attach_images(items, path)
            self.assertEqual(items, before)
            with path.open('w', encoding='utf-8-sig', newline='') as stream:
                writer = csv.DictWriter(stream, fieldnames=['id', '品名', '出典ページ', '画像URL', '取得結果', '理由'])
                writer.writeheader()
                writer.writerows([
                    dict(id=1, 品名='品', 出典ページ='https://example.com/item', 画像URL='https://example.com/photo.jpg', 取得結果='取得'),
                    dict(id=2, 品名='別', 出典ページ='https://example.com/other', 画像URL='https://example.com/no.jpg', 取得結果='未取得')])
            module.attach_images(items, path)
            self.assertEqual(items[0]['img'], 'https://example.com/photo.jpg')
            self.assertEqual(items[0]['imgsrc'], 'https://example.com/item')
            self.assertEqual({k: v for k, v in items[0].items() if k not in ('img', 'imgsrc')}, before[0])
            self.assertEqual(items[1], before[1])

    def test_real_image_mapping(self):
        import csv
        path = Path(__file__).resolve().parents[1] / 'data/images/item_images.csv'
        if not path.exists():
            return
        with path.open(encoding='utf-8-sig', newline='') as source:
            rows = list(csv.DictReader(source))
        items = [module.convert({'品名': row['品名']}, int(row['id'])) for row in rows]
        module.attach_images(items, path)
        for item, row in zip(items, rows):
            if row['取得結果'] == '取得':
                self.assertEqual(item['img'], row['画像URL'])
                self.assertEqual(item['imgsrc'], row['出典ページ'])
            else:
                self.assertNotIn('img', item)
