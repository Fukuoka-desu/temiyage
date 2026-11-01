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

    def test_packaging_three_states(self):
        for raw, expected in [('有', True), ('無', False), ('不明', None), ('', None)]:
            self.assertIs(module.convert({'個包装': raw, 'タグ': '個包装'}, 1)['ko'], expected)

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


class ShelfPackTests(unittest.TestCase):
    def test_supplements_identity_priority_and_urls(self):
        import csv
        import copy
        from tempfile import TemporaryDirectory
        items = [module.convert({'品名': '品'}, i) for i in range(1, 9)]
        items[1].update(d=0, dr='当日', ko=False)
        items[2]['n'] = '別名'
        items[3]['ko'] = True
        before = copy.deepcopy(items)
        with TemporaryDirectory(dir=Path(__file__).resolve().parents[1]) as directory:
            path = Path(directory) / 'overrides.csv'
            self.assertEqual(module.attach_shelf_pack(items, path), dict(shelf=0, pack=0))
            self.assertEqual(items, before)
            with path.open('w', encoding='utf-8', newline='') as stream:
                writer = csv.DictWriter(stream, fieldnames=['id', '品名', '日持ち日数', '日持ち原文', '日持ち根拠URL', '個包装', '個包装根拠URL'])
                writer.writeheader()
                for i in range(1, 9):
                    writer.writerow(dict(id=99 if i == 8 else i, 品名='品',
                        日持ち日数='' if i == 5 else '不明' if i == 6 else '14',
                        日持ち原文='製造日より14日',
                        日持ち根拠URL='javascript:alert(1)' if i == 7 else 'https://example.com/days',
                        個包装='' if i == 5 else '不明' if i == 6 else '無' if i == 7 else '有',
                        個包装根拠URL='ftp://example.com' if i == 7 else 'http://example.com/pack'))
            self.assertEqual(module.attach_shelf_pack(items, path), dict(shelf=3, pack=2))
        self.assertEqual(items[0]['d'], 14)
        self.assertEqual(items[0]['dr'], '製造日より14日')
        self.assertEqual(items[0]['du'], 'https://example.com/days')
        self.assertIs(items[0]['ko'], True)
        self.assertEqual(items[0]['ku'], 'http://example.com/pack')
        for index in [1, 2, 4, 5, 7]:
            self.assertEqual(items[index], before[index])
        self.assertIs(items[3]['ko'], True)
        self.assertNotIn('ku', items[3])
        self.assertEqual(items[6]['d'], 14)
        self.assertIs(items[6]['ko'], False)
        self.assertNotIn('du', items[6])
        self.assertNotIn('ku', items[6])
