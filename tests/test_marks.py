import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('build_marks', Path(__file__).resolve().parents[1] / 'scripts/build_marks.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def marks(**values):
    row = {'品名': '', 'ジャンル': '', '内容量': '', '個包装': '', '税込価格(円)': '', '日持ち(日)': ''}
    row.update(values)
    return module.mark_item(row)


class MarkTests(unittest.TestCase):
    def test_tea_exclusions(self):
        self.assertNotIn('tea', marks(品名='煎茶のお茶漬け', ジャンル='茶'))
        self.assertNotIn('tea', marks(品名='紅茶クッキー', ジャンル='洋菓子'))
        self.assertNotIn('tea', marks(品名='抹茶羊羹', ジャンル='和菓子'))
        self.assertIn('tea', marks(品名='ドリップ珈琲'))

    def test_family_and_quantities(self):
        self.assertNotIn('bigfamily', marks(ジャンル='酒', 内容量='12本'))
        self.assertNotIn('bigfamily', marks(ジャンル='酒', 内容量='12個'))
        self.assertNotIn('bigfamily', marks(内容量='12粒'))
        self.assertIn('bigfamily', marks(内容量='６個入×２'))
        self.assertEqual(module.quantities('6個×2（計10個）')[0], 10)
        self.assertEqual(module.quantities('3枚入×4袋')[0], 12)
        self.assertEqual(module.quantities('100g×3'), (None, 300, None))
        self.assertEqual(module.quantities('0.5L'), (None, None, 500))
        self.assertEqual(module.quantities('6〜12個'), (None, None, None))

    def test_single_limits(self):
        self.assertIn('single', marks(内容量='6本', **{'税込価格(円)': '３０００'}))
        self.assertIn('single', marks(内容量='0.3kg', **{'税込価格(円)': '1000'}))
        self.assertNotIn('single', marks(内容量='301g', **{'税込価格(円)': '1000'}))
        self.assertNotIn('single', marks(内容量='6個', **{'税込価格(円)': '不明'}))

    def test_office(self):
        self.assertIn('office', marks(個包装='有', 内容量='8個', **{'日持ち(日)': '7'}))
        self.assertIn('office', marks(品名='個包装詰合せ'))
        self.assertNotIn('office', marks(個包装='有', 内容量='7個'))
        self.assertNotIn('office', marks(個包装='有', 内容量='12個', **{'日持ち(日)': '6'}))
        self.assertNotIn('office', marks(好みタグ='個包装', 内容量='12個'))

    def test_allowed_columns_and_words(self):
        self.assertEqual(marks(メーカー='無添加煎茶限定', 好みタグ='ヘルシー'), {})
        self.assertIn('elderly', marks(品名='栗羊羹', ジャンル='和菓子'))
        self.assertNotIn('cooking', marks(品名='塩チョコ', ジャンル='チョコ'))
        self.assertNotIn('gorgeous', marks(品名='魚の缶詰', ジャンル='おつまみ'))
        self.assertIn('gorgeous', marks(品名='クッキー缶', ジャンル='洋菓子'))
        self.assertIn('business', marks(ジャンル='茶', **{'税込価格(円)': '3000'}))
        self.assertNotIn('business', marks(ジャンル='茶', **{'税込価格(円)': '2999'}))

    def test_season_and_use_marks(self):
        self.assertIn('summer_fit', marks(品名='水ようかん', **{'要冷蔵/冷凍': '常温'}))
        self.assertNotIn('summer_fit', marks(品名='ゼリー', **{'要冷蔵/冷凍': '不明'}))
        self.assertNotIn('summer_fit', marks(品名='ゼリー', **{'要冷蔵/冷凍': '冷蔵'}))
        self.assertIn('summer_caution', marks(**{'要冷蔵/冷凍': '夏季クール便'}))
        self.assertIn('short_keep', marks(**{'日持ち(日)': '6'}))
        self.assertNotIn('short_keep', marks(**{'日持ち(日)': '不明'}))
        self.assertNotIn('short_keep', marks(**{'日持ち(日)': '7'}))
        self.assertIn('winter_fit', marks(品名='昆布'))
        self.assertIn('newyear_fit', marks(品名='紅白饅頭'))
        self.assertIn('alcohol', marks(ジャンル='酒'))
        self.assertIn('flashy', marks(品名='限定セット'))
        self.assertIn('classic_sweets', marks(ジャンル='和菓子', **{'税込価格(円)': '3000'}))
        self.assertNotIn('classic_sweets', marks(ジャンル='チョコ', **{'税込価格(円)': '3000'}))
        self.assertIn('easy_share', marks(内容量='10個'))


if __name__ == '__main__':
    unittest.main()
