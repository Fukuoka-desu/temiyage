"""Independent specification filters over JSON; the application runs in Node separately.
Budget bands include the documented 80% lower / 115% upper near-budget allowance.
Traits, relationship, season and use affect ranking only, never eligibility.
"""
import json
import re
import subprocess
import unicodedata
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ITEMS = json.loads((ROOT / 'src/data/items.json').read_text())
MARKS = json.loads((ROOT / 'src/data/marks.json').read_text())
DEFAULT = dict(pref='東京', mine='', home='avoid', likes=['甘いもの'], traits=[], rel='',
               nosweet=False, keep=False, pu=False, budget='b1', season='none', use='visit',
               sort='recommend', fpref='', genre='', q='')
LIKES = {'甘いもの': ['和菓子', '洋菓子', 'チョコ'], '和菓子': ['和菓子'],
         '洋菓子': ['洋菓子'], 'チョコレート': ['チョコ'], 'お酒': ['お酒'],
         'コーヒー・紅茶': ['コーヒー・紅茶'], '日本茶': ['日本茶'],
         '辛党・おつまみ': ['おつまみ'], 'ご飯のお供': ['ご飯のお供'],
         'ヘルシー': ['ヘルシー'], '果物': ['果物'], '家族向け': ['個包装']}


def norm(text):
    text = unicodedata.normalize('NFKC', text).lower()
    return ''.join(chr(ord(ch)-96) if 'ァ' <= ch <= 'ヶ' else ch for ch in text)


def eligible(c):
    low, high = {'b1': (0, 3450), 'b2': (2400, 5750),
                 'b3': (4000, 11500), 'b4': (8000, float('inf')), 'any': (0, float('inf'))}[c['budget']]
    selected = []
    for i in ITEMS:
        tags = set(i['t']) - {'個包装'}
        if i['ko']:
            tags.add('個包装')
        if i['y'] is None:
            if c['budget'] != 'any' and not c['pu']:
                continue
        elif not low <= i['y'] <= high:
            continue
        if c['home'] == 'avoid' and i['p'] == c['pref']:
            continue
        if c['nosweet'] and tags.intersection({'和菓子', '洋菓子', 'チョコ'}):
            continue
        if c['keep'] and i['d'] is not None and i['d'] < 7:
            continue
        if c['likes'] and not any(tags.intersection(LIKES[k]) for k in c['likes']):
            continue
        if c['fpref'] and c['fpref'] != i['p']:
            continue
        if c['genre'] and c['genre'] != i['g']:
            continue
        fields = [norm(i[k]) for k in ('n', 'm', 'p', 'q')]
        if not all(any(word in field for field in fields) for word in norm(c['q']).split()):
            continue
        selected.append(i)
    return selected


def warnings(i, c):
    m = MARKS.get(str(i['id']), {})
    return (int(c['season'] == 'chugen' and 'summer_caution' in m)
            + int(c['use'] == 'apology' and bool({'alcohol', 'flashy'} & m.keys()))
            + int(c['use'] == 'mimai' and 'alcohol' in m)
            + int(c['use'] == 'mimai' and 'short_keep' in m))


def cases():
    out = [('既定条件', {})]
    for pref in ['北海道', '沖縄', '東京']:
        for home in ['avoid', 'nostalgic']:
            for mine in ['', '大阪', pref]:
                out.append((f'出身={pref} 地元={home} こちら={mine or "未指定"}', dict(pref=pref, home=home, mine=mine)))
    out += [('好み1つ', {'likes': ['日本茶']}), ('好み2つOR', {'likes': ['日本茶', 'お酒']}),
            ('好みなし', {'likes': []}), ('甘いもの苦手', {'likes': [], 'nosweet': True}),
            ('日持ち重視', {'keep': True})]
    for budget in ['b1', 'b2', 'b3', 'b4']:
        out.append((f'予算{budget} 境界含む', dict(budget=budget, likes=[], home='nostalgic')))
    out += [('予算any 既定条件', {'budget': 'any'}),
            ('予算any 好みなし', {'budget': 'any', 'likes': []}),
            ('予算any 好みなし 全候補', {'budget': 'any', 'likes': [], 'home': 'nostalgic'}),
            ('b1 価格不明も含む', {'pu': True}),
            ('共有any pu', {'budget': 'any', 'pu': True})]
    for sort in ['low', 'high', 'recommend', 'days']:
        out.append((f'any 末尾確認 {sort}', {'budget': 'any', 'likes': [], 'sort': sort}))
    for label, patch in [
        ('産地京都', {'fpref': '京都'}), ('ジャンル和菓子', {'genre': '和菓子'}),
        ('半角検索', {'q': 'ﾁｮｺ'}), ('全角検索', {'q': 'チョコ'}), ('ひらがな検索', {'q': 'ちょこ'}),
        ('前後全角空白', {'q': '　 チョコ　 '}), ('空白のみ', {'q': '　  '}),
        ('複数語AND', {'q': '京都 まんじゅう'}),
        ('好み県検索', {'likes': ['和菓子', '洋菓子'], 'fpref': '京都', 'q': 'まんじゅう'}),
        ('0件', {'q': '存在しない商品XYZ999'}), ('地元除外と県指定0件', {'fpref': '東京'}),
        ('お中元', {'likes': [], 'season': 'chugen', 'use': 'thanks'}),
        ('お詫び', {'likes': [], 'use': 'apology'}), ('お見舞い', {'likes': [], 'use': 'mimai'}),
        ('全共有項目', {'likes': [], 'traits': ['tea', 'single'], 'rel': 'business', 'season': 'chugen', 'use': 'office', 'mine': '', 'keep': True}),
    ]:
        out.append((label, patch))
    return [dict(label=label, patch=patch) for label, patch in out]


class CountTests(unittest.TestCase):
    def test_independent_counts(self):
        tests = cases()
        tests.append(dict(label='旧URL use=first / mine=大阪', patch={'mine': '大阪'}, url='?use=first&mine=大阪'))
        for budget in ['b1', 'b2', 'b3', 'b4']:
            tests.append(dict(label=f'仮想商品による境界{budget}', patch=dict(budget=budget, likes=[], home='nostalgic'), boundary=True))
        actual = json.loads(subprocess.check_output(['node', 'tests/count_actual.mjs'], cwd=ROOT,
                                                   input=json.dumps(tests).encode()))
        report = ['# 件数比較', '', '期待値: items.json・marks.jsonへの独立した単純フィルタ。実際値: Nodeでsrc/libを実行。',
                  '予算帯は境界・近似予算（下限80%〜上限115%）を含む。anyは価格制限なし・不明も含む。pu=1は予算帯に価格不明を追加。', '',
                  '|条件|期待|実際|一致|', '|---|---:|---:|:---:|']
        failures = []
        for test, a in zip(tests, actual):
            c = {**DEFAULT, **test['patch']}
            expected = eligible(c)
            if test.get('boundary'):
                included = {'b1': [3000], 'b2': [3000, 5000], 'b3': [5000, 10000], 'b4': [10000]}[c['budget']]
                expected = [dict(ITEMS[0], id=10001+index, y=price, p='境界テスト', t=[], ko=False)
                            for index, price in enumerate([3000, 5000, 10000]) if price in included]
            good = len(expected) == a['count']
            report.append(f"|{test['label']}|{len(expected)}|{a['count']}|{'○' if good else '×'}|")
            if not good:
                failures.append(test['label'])
            with self.subTest(condition=test['label']):
                self.assertEqual(set(a['ids']), {i['id'] for i in expected})
                self.assertEqual(a['roundCount'], a['count'])
                warning_ids = {i['id'] for i in expected if warnings(i, c)}
                self.assertEqual(set(a['cautionIds']), warning_ids)
                self.assertEqual(a['cautionTotal'], sum(warnings(i, c) for i in expected))
                priced = [i for i in expected if i['y'] is not None]
                verified = sum(i['v'] for i in priced)
                n = min(24, verified)
                by_id = {i['id']: i for i in [*ITEMS, *expected]}
                self.assertTrue(all(by_id[i]['v'] for i in a['ids'][:n]))
                unknown_ids = {i['id'] for i in expected if i['y'] is None}
                self.assertEqual(set(a['ids'][len(priced):]), unknown_ids)
                for group in [a['ids'][:len(priced)], a['ids'][len(priced):]]:
                    flags = [by_id[i]['v'] for i in group]
                    self.assertEqual(flags, sorted(flags, reverse=True))
                self.assertEqual(a['restored']['budget'], c['budget'])
                self.assertEqual(a['restored']['pu'], c['pu'])
                if c['budget'] == 'b1' and not c['pu']:
                    self.assertFalse(unknown_ids)
                if test['label'] == 'b1 価格不明も含む':
                    self.assertEqual(a['count'], len(eligible(DEFAULT)) + len(unknown_ids))
                if test['label'] == '予算any 好みなし 全候補':
                    self.assertEqual(len(unknown_ids), 53)
                    self.assertEqual(a['count'], len(ITEMS))
                if test['label'] == '予算any 既定条件':
                    report.append(f"|↳ 価格有り {len(priced)}件 / 価格不明 {len(unknown_ids)}件|—|—|○|")
                if warning_ids:
                    before = sum(a['baselineIds'].index(i)+1 for i in warning_ids)/len(warning_ids)
                    after = sum(a['ids'].index(i)+1 for i in warning_ids)/len(warning_ids)
                    report.append(f"|↳ 注意付き{len(warning_ids)}件・平均順位 {before:.2f}→{after:.2f}|—|—|{'○' if after > before else '×'}|")
                    self.assertGreater(after, before)
                if test['label'].startswith('予算'):
                    for price in [3000, 5000, 10000]:
                        ids = {i['id'] for i in expected if i['y'] == price}
                        self.assertTrue(ids.issubset(set(a['ids'])))

                if test.get('url'):
                    self.assertEqual(a['restored']['use'], 'visit')
                    self.assertEqual(a['restored']['mine'], '大阪')
        report += ['', f'{len(tests)}条件。価格不明が末尾、各価格グループ内で確認済み優先、注意付き件数・注意総数、共有URL往復・旧URLも検証。',
                   '実データに存在しない境界価格は専用の仮想商品（3000・5000・10000円）でも4帯を確認。',
                   f'件数不一致: {len(failures)}。']
        (ROOT / 'tests/count_report.md').write_text('\n'.join(report)+'\n')
        self.assertFalse(failures)
