# 検証結果

`npm run build`（prebuild込み）、`npm run typecheck`、`npm test` が成功。Python 8テスト、Node 43テスト。

## 印の件数

| 印 | 件数 |
|---|---:|
| banshaku（晩酌が好き） | 132 |
| tea（コーヒー・お茶が好き） | 14 |
| cooking（料理好き） | 27 |
| sweets（甘党） | 707 |
| health（健康志向） | 2 |
| bigfamily（家族や子どもが多い） | 220 |
| single（一人暮らし） | 354 |
| elderly（お年寄りがいる） | 98 |
| gorgeous（パッケージが華やか） | 49 |
| talk（話のネタになる） | 12 |
| business（取引先・目上の人） | 128 |
| casual（気軽な相手） | 569 |
| office（職場で配る） | 62 |
| summer_fit（夏向き） | 16 |
| summer_caution（夏の保存に注意） | 128 |
| winter_fit（冬向き） | 179 |
| newyear_fit（新年向き） | 10 |
| short_keep（日持ちが短い） | 40 |
| alcohol（お酒） | 96 |
| flashy（嗜好が分かれやすい） | 48 |
| classic_sweets（定番の和洋菓子） | 61 |
| easy_share（分けやすい） | 241 |

## 注意が出る品の件数

好み・土地・価格帯で偏らないよう、好み指定なし、地元除外なし、全予算帯の候補をIDで重複除去。価格不明の品は通常どおり候補に含めない。各行は他方を既定（時期none／用途visit）とした独立集計。

| 条件 | 件数 |
|---|---:|
| 時期：季節を問わない | 0 |
| 時期：お中元（夏） | 122 |
| 時期：お歳暮（冬） | 0 |
| 時期：お年賀 | 0 |
| 用途：お礼 | 0 |
| 用途：お詫び | 131 |
| 用途：ご挨拶・訪問 | 0 |
| 用途：お祝い | 0 |
| 用途：お見舞い | 129 |
| 用途：帰省・旅行のおみやげ | 0 |
| 用途：職場への差し入れ | 0 |

## 文言検索

指定の `rg -n "大阪|初訪問|first|941|850|12種" src index.html README.md` を実施。大阪は都道府県リストと商品データ、firstは旧URL読み替え・READMEの説明・CSSのfirst-child。941・850は生成JSONの商品ID・価格・根拠の値。固定収録件数、初訪問、12種の旧説明は残っていない。

## 変更ファイル

- package.json
- scripts/build_data.py、scripts/build_marks.py
- src/lib/marks.ts、src/lib/score.ts、src/lib/url.ts
- src/App.tsx、src/styles.css
- src/data/items.json、src/data/marks.json（生成）
- data/marks/mark_rules.csv、data/marks/item_marks.csv（生成）
- index.html、README.md
- tests/score.test.mjs、tests/url.test.mjs、tests/test_marks.py、tests/test_data.py、tests/assert.mjs（書式）
- WORK_REPORT.md（本報告）

ビルドによるdistとTypeScriptのキャッシュも再生成。元CSVは読み取りのみ。Git操作・push・デプロイは未実施。
