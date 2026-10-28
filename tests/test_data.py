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
