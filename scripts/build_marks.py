#!/usr/bin/env python3
"""指定された7列だけで印を判定する。元データは変更しない。"""
import csv
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('/workspace/temiyage/temiyage_master.csv')
SWEETS = {'和菓子', '洋菓子', 'チョコ'}
TEA = '煎茶|緑茶|ほうじ茶|番茶|玉露|紅茶|コーヒー|珈琲|ドリップ|ティーバッグ'
COOKING = '醤油|しょうゆ|味噌|みそ|だし|出汁|ソース|ドレッシング|ポン酢|ぽん酢|酢|調味|塩|胡椒|こしょう|一味|七味|山椒|唐辛子|麺|そば|蕎麦|うどん|ラーメン|そうめん|素麺|昆布|鰹節|かつお節|干物|カレー'
HEALTH = '無添加|減塩|糖質|オーガニック|有機|低糖|砂糖不使用|ノンシュガー|食物繊維|雑穀|玄米|黒酢|寒天|ドライフルーツ'
ELDERLY = '羊羹|ようかん|ゼリー|プリン|葛|くず|わらび|求肥|カステラ|饅頭|まんじゅう|どら焼|どらやき|やわらか|柔らか|ムース|茶漬'
LOOK = '化粧箱|木箱|桐箱|風呂敷|缶入|ギフトボックス|アソート'
TALK = '元祖|復刻|限定|珍味|ご当地|発祥|日本一|最古'
QUANTITY_RULE = (
    '内容量をNFKC正規化し、対象単位の整数N（入・入りも可）を合計。'
    '通常の対象単位は個・枚・袋・包・切れ・切・本・粒。'
    '家族や子どもが多いの対象単位は個・枚・袋・包・切れ・切のみ。'
    '直後の×N・xN・XNは乗算、計N単位を優先。'
    '重量g・kg、容量ml・L・lは別集計（小数可、直後の乗数も適用）。'
    '範囲記号~・〜・～、約・以上・以下・前後を含む内容量は数量・重量・容量とも不明。'
)
RULES = [
    ('banshaku', 'hobby', '晩酌が好き', 'ジャンルが酒またはおつまみ'),
    ('tea', 'hobby', 'コーヒー・お茶が好き', f'品名に茶漬を含まず、ジャンルが和菓子・洋菓子・チョコ以外で、ジャンルが茶・コーヒー、または品名に次の語を含む: {TEA}'),
    ('cooking', 'hobby', '料理好き', f'ジャンルが和菓子・洋菓子・チョコ・酒以外で、品名に次の語を含む: {COOKING}'),
    ('sweets', 'hobby', '甘党', 'ジャンルが和菓子・洋菓子・チョコ'),
    ('health', 'hobby', '健康志向', f'品名に次の語を含む: {HEALTH}'),
    ('bigfamily', 'family', '家族や子どもが多い', 'ジャンルが酒以外、内容量の数が10以上。個・枚・袋・包・切・切れのみ（入・入り可）。本・粒・重さ・容量は対象外。' + QUANTITY_RULE),
    ('single', 'family', '一人暮らし', '税込価格(円)が3000以下、かつ内容量が次のいずれか: 数が1以上6以下、重量が0より大きく300g以下、容量が0より大きく500ml以下。' + QUANTITY_RULE),
    ('elderly', 'family', 'お年寄りがいる', f'ジャンルが酒以外で、品名に次の語を含む: {ELDERLY}'),
    ('gorgeous', 'look', 'パッケージが華やか', f'品名または内容量に次の語を含む: {LOOK}。またはジャンルが和菓子・洋菓子・チョコ・茶で、品名に缶を含み缶詰を含まない'),
    ('talk', 'look', '話のネタになる', f'品名に次の語を含む: {TALK}'),
    ('business', 'scene', '取引先・目上の人', '税込価格(円)が3000以上で、ジャンルが和菓子・洋菓子・チョコ・茶・コーヒー・酒'),
    ('casual', 'scene', '気軽な相手', '税込価格(円)が2000以下'),
    ('office', 'scene', '職場で配る', '（個包装が有、または品名・内容量に個包装を含む）、かつ（内容量の数が8以上または数量不明）。日持ち(日)が判読できて7未満なら除外。' + QUANTITY_RULE),

    ('summer_fit', 'season', '夏向き', '品名にゼリー|水ようかん|水羊羹|葛|くず|わらび|そうめん|素麺|冷麦|うどん|そば|蕎麦|ビール|ジュース|果汁|サイダー|ラムネを含み、要冷蔵/冷凍が空か常温'),
    ('summer_caution', 'season', '夏の保存に注意', '日持ち(日)が判読できて7未満、または要冷蔵/冷凍に冷蔵|冷凍|クール便を含む'),
    ('winter_fit', 'season', '冬向き', 'ジャンルが酒・ご飯のお供・おつまみ、または品名に蒲鉾|かまぼこ|干物|昆布|鍋|そば|蕎麦|うどん|ハムを含む'),
    ('newyear_fit', 'season', '新年向き', '品名に年賀|干支|紅白|寿|迎春|正月|初春|鏡を含む'),
    ('short_keep', 'caution', '日持ちが短い', '日持ち(日)が判読できて7未満'),
    ('alcohol', 'caution', 'お酒', 'ジャンルが酒'),
    ('flashy', 'caution', '嗜好が分かれやすい', 'ジャンルがおつまみ、またはtalkの印、または品名に珍味を含む'),
    ('classic_sweets', 'scene', '定番の和洋菓子', 'ジャンルが和菓子・洋菓子でbusinessの印が付く'),
    ('easy_share', 'scene', '分けやすい', 'bigfamilyまたはofficeの印が付く'),
]


def normalize(value):
    return unicodedata.normalize('NFKC', value or '').strip()


def number(value):
    value = normalize(value)
    return float(value) if re.fullmatch(r'\d+(?:\.\d+)?', value) else None


def quantities(value, family=False):
    """明示された単位だけを読む。計の表記は内訳より優先する。"""
    value = normalize(value)
    if re.search(r'[~〜～]|約|以上|以下|前後', value):
        return None, None, None
    units = r'個|枚|袋|包|切れ|切' if family else r'個|枚|袋|包|切れ|切|本|粒'
    total = re.search(r'計\s*(\d+)\s*(?:' + units + r')(?:入(?:り)?)?', value)
    counts = list(re.finditer(r'(\d+)\s*(?:' + units + r')(?:入(?:り)?)?(?:\s*[×xX]\s*(\d+))?', value))
    if total:
        count = int(total[1])
    elif counts:
        count = sum(int(match[1]) * int(match[2] or 1) for match in counts)
    else:
        count = None
    weights, volumes = [], []
    for m in re.finditer(r'(\d+(?:\.\d+)?)\s*(kg|g|ml|L|l)(?![A-Za-z])(?:\s*[×xX]\s*(\d+))?', value):
        amount = float(m[1]) * int(m[3] or 1)
        if m[2] in ('kg', 'g'):
            weights.append(amount * (1000 if m[2] == 'kg' else 1))
        else:
            volumes.append(amount * (1000 if m[2] in ('L', 'l') else 1))
    return count, sum(weights) if weights else None, sum(volumes) if volumes else None


def mark_item(row):
    # 許可された列以外を参照しない。
    name, genre, quantity, wrapped = [
        normalize(row.get(key, ''))
        for key in ('品名', 'ジャンル', '内容量', '個包装')
    ]
    price, days = [number(row.get(k, '')) for k in ('税込価格(円)', '日持ち(日)')]
    count, grams, ml = quantities(quantity)
    family_count = quantities(quantity, family=True)[0]
    marks = {}

    def put(key, condition, evidence):
        if condition:
            marks[key] = evidence

    def word(key, words, allowed=True):
        match = re.search(words, name)
        put(key, allowed and match is not None, f'品名に「{match[0]}」' if match else '')

    put('banshaku', genre in {'酒', 'おつまみ'}, f'ジャンル={genre}')
    if '茶漬' not in name and genre not in SWEETS:
        if genre in {'茶', 'コーヒー'}:
            marks['tea'] = f'ジャンル={genre}'
        else:
            word('tea', TEA)
    word('cooking', COOKING, genre not in SWEETS | {'酒'})
    put('sweets', genre in SWEETS, f'ジャンル={genre}')
    word('health', HEALTH)
    put('bigfamily', genre != '酒' and family_count is not None and family_count >= 10, f'ジャンル={genre}・内容量の数={family_count}')
    small = []
    for amount, bound, label in [(count, 6, '数'), (grams, 300, '重量(g)'), (ml, 500, '容量(ml)')]:
        if amount is not None and 0 < amount <= bound:
            small.append(f'内容量の{label}={amount:g}')
    put('single', price is not None and price <= 3000 and bool(small), f'税込価格(円)={price:g}・' + '・'.join(small) if price is not None else '')
    word('elderly', ELDERLY, genre != '酒')
    for column, value in [('品名', name), ('内容量', quantity)]:
        match = re.search(LOOK, value)
        if match:
            marks['gorgeous'] = f'{column}に「{match[0]}」'
            break
    if 'gorgeous' not in marks:
        put('gorgeous', genre in SWEETS | {'茶'} and '缶' in name and '缶詰' not in name, f'ジャンル={genre}・品名に「缶」（缶詰なし）')
    word('talk', TALK)
    put('business', price is not None and price >= 3000 and genre in SWEETS | {'茶', 'コーヒー', '酒'}, f'ジャンル={genre}・税込価格(円)={price:g}' if price is not None else '')
    put('casual', price is not None and price <= 2000, f'税込価格(円)={price:g}' if price is not None else '')
    wrap_reason = '個包装=有' if wrapped == '有' else '品名に「個包装」' if '個包装' in name else '内容量に「個包装」' if '個包装' in quantity else ''
    put('office', bool(wrap_reason) and (count is None or count >= 8) and (days is None or days >= 7), f'{wrap_reason}・内容量の数={count if count is not None else "不明"}・日持ち(日)={days if days is not None else "不明"}')
    storage = normalize(row.get('要冷蔵/冷凍', ''))
    word('summer_fit', 'ゼリー|水ようかん|水羊羹|葛|くず|わらび|そうめん|素麺|冷麦|うどん|そば|蕎麦|ビール|ジュース|果汁|サイダー|ラムネ', storage in {'', '常温'})
    if 'summer_fit' in marks:
        marks['summer_fit'] += f'・要冷蔵/冷凍={storage or "空欄"}'
    put('short_keep', days is not None and days < 7, f'日持ち(日)={days}')
    cold = re.search('冷蔵|冷凍|クール便', storage)
    put('summer_caution', 'short_keep' in marks or cold is not None,
        '・'.join(filter(None, [marks.get('short_keep'), f'要冷蔵/冷凍={storage}' if cold else ''])))
    if genre in {'酒', 'ご飯のお供', 'おつまみ'}:
        marks['winter_fit'] = f'ジャンル={genre}'
    else:
        word('winter_fit', '蒲鉾|かまぼこ|干物|昆布|鍋|そば|蕎麦|うどん|ハム')
    word('newyear_fit', '年賀|干支|紅白|寿|迎春|正月|初春|鏡')
    put('alcohol', genre == '酒', f'ジャンル={genre}')
    put('flashy', genre == 'おつまみ' or 'talk' in marks or '珍味' in name,
        f'ジャンル={genre}' if genre == 'おつまみ' else marks.get('talk', '品名に「珍味」'))
    put('classic_sweets', genre in {'和菓子', '洋菓子'} and 'business' in marks,
        marks.get('business', ''))
    share = [f'{key}: {marks[key]}' for key in ('bigfamily', 'office') if key in marks]
    put('easy_share', bool(share), '・'.join(share))
    return marks


def main():
    out = ROOT / 'data/marks'
    out.mkdir(parents=True, exist_ok=True)
    with (out / 'mark_rules.csv').open('w', encoding='utf-8', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(['項目ID', 'グループ', '項目', '条件', '根拠の書き方'])
        for key, group, label, rule in RULES:
            writer.writerow([key, group, label, 'NFKC正規化後に判定。' + rule, '一致した列の値・語、読み取れた数量を具体的に記載'])
    columns = ['都道府県', '品名', 'メーカー', 'ジャンル', '内容量', '個包装', '税込価格(円)', '日持ち(日)', '要冷蔵/冷凍']
    result = {}
    counts = dict.fromkeys([rule[0] for rule in RULES], 0)
    with SOURCE.open(encoding='utf-8-sig', newline='') as source, (out / 'item_marks.csv').open('w', encoding='utf-8', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(['id', *columns, '印', *[f'{r[2]}の根拠' for r in RULES]])
        for item_id, row in enumerate(csv.DictReader(source), 1):
            marks = mark_item(row)
            if marks:
                result[str(item_id)] = marks
            writer.writerow([item_id, *[row.get(c, '') for c in columns], ';'.join(r[2] for r in RULES if r[0] in marks), *[marks.get(r[0], '') for r in RULES]])
            for key in marks:
                counts[key] += 1
    (ROOT / 'src/data/marks.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    for key, _, label, _ in RULES:
        print(f'{key}: {label} = {counts[key]}件')


if __name__ == '__main__':
    main()
