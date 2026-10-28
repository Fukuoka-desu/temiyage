import { describe, it } from 'node:test';
import { expect } from './assert.mjs';
import { readFileSync } from 'node:fs';
const data = JSON.parse(readFileSync(new URL('../src/data/items.json', import.meta.url), 'utf8'));
import { defaults, filterSort, normalize, scoreItems } from '../.test-build/score.js';
const base = {
  id: 1,
  r: '近畿',
  p: '大阪',
  n: 'テスト',
  q: '1箱',
  m: 'メーカー',
  y: 2000,
  d: 30,
  dr: '30日',
  st: '',
  sr: '',
  ko: true,
  g: '和菓子',
  t: ['和菓子', '定番', '高級感'],
  u: 'https://example.com',
  src: '公式',
  c: '2026-10-28',
  v: true,
  vr: '',
};
const run = (patch = {}, conditions = {}) =>
  scoreItems([{ ...base, ...patch }], { ...defaults, ...conditions });
describe('スコアと除外条件', () => {
  it('初訪問・甘いもの・贈り手の土地を加点する', () => {
    expect(run()[0].score).toBe(16.5);
    expect(run()[0].why[0]).toBe('こちらの土地の名物で話題になる');
  });
  it('価格未記載、苦手、相手の地元、短い日持ちを除く', () => {
    expect(run({ y: null })).toEqual([]);
    expect(run({}, { nosweet: true })).toEqual([]);
    expect(run({ p: '東京' })).toEqual([]);
    expect(run({ d: 6 }, { keep: true })).toEqual([]);
    expect(run({ d: null }, { keep: true })).toHaveLength(1);
  });
  it('予算境界・許容範囲の端を含む', () => {
    expect(run({ y: 3000 })).toHaveLength(1);
    expect(run({ y: 3450 })[0].why).toContain('予算に近い');
    expect(run({ y: 3451 })).toEqual([]);
    expect(run({ y: 2400 }, { budget: 'b2' })).toHaveLength(1);
    expect(run({ y: 2399 }, { budget: 'b2' })).toEqual([]);
    expect(run({ y: 100000 }, { budget: 'b4' })).toHaveLength(1);
  });
  it('好みのヒット数と個包装列による家族向けを評価する', () => {
    expect(run({}, { likes: ['和菓子', '家族向け'] })[0].score).toBe(20.5);
    expect(run({}, { likes: ['果物'] })).toEqual([]);
    expect(run({}, { likes: [] })).toHaveLength(1);
    expect(run({}, { likes: ['家族向け'] })[0].why).toContain('個包装で分けやすい');
  });
  it('懐かしい地元は最初の理由になり8点を加点する', () => {
    const result = run({ p: '東京' }, { home: 'nostalgic' })[0];
    expect(result.why[0]).toBe('相手の地元の懐かしい味');
    expect(result.score).toBe(21.5);
  });
  for (const [use, score] of [
    ['apology', 18.5],
    ['thanks', 15.5],
    ['office', 17.5],
    ['celebrate', 14.5],
  ])
    it(`${use} の用途別スコア`, () => expect(run({}, { use })[0].score).toBe(score));
  it('お詫びのお酒・おつまみの減点と職場の個包装なしを計算する', () => {
    expect(
      run({ t: ['お酒', 'おつまみ'], ko: false }, { likes: [], use: 'apology' })[0].score,
    ).toBe(5.5);
    expect(run({ ko: false }, { use: 'office' })[0].score).toBe(10.5);
  });
  it('日持ち重視で30日以上に加点する', () => {
    expect(run({}, { keep: true })[0].score).toBe(18.5);
  });
  it('低スコアの確認済みも要確認より前、同点は安い順', () => {
    const result = scoreItems(
      [
        { ...base, id: 1, v: false },
        { ...base, id: 2, t: ['和菓子'], ko: false, y: 2500 },
        { ...base, id: 3, t: ['和菓子'], ko: false, y: 2000 },
      ],
      defaults,
    );
    expect(result.map((r) => r.item.id)).toEqual([3, 2, 1]);
  });
});
describe('実データ・表示絞り込み', () => {
  it('収録数と欠損値を保持する', () => {
    expect(data).toHaveLength(941);
    expect(data.filter((i) => i.v)).toHaveLength(850);
    expect(data.filter((i) => i.y === null)).toHaveLength(53);
    expect(data.filter((i) => i.d === null)).toHaveLength(389);
    expect(new Set(data.map((i) => i.p)).size).toBe(47);
  });
  it('初期候補の上位12件は確認済み', () => {
    const results = scoreItems(data, defaults);
    expect(results.length).toBeGreaterThan(12);
    expect(results.slice(0, 12).every((r) => r.item.v)).toBe(true);
  });
  it('おすすめ順は低スコアの確認済みを優先し、他の並べ替えでも確認状態を保持する', () => {
    const results = scoreItems(
      [
        { ...base, id: 1, v: false, y: 1000, d: 90 },
        { ...base, id: 2, t: ['和菓子'], ko: false, y: 3000, d: 7 },
      ],
      defaults,
    );
    expect(filterSort(results, defaults).map((r) => r.item.id)).toEqual([2, 1]);
    for (const sort of ['low', 'high', 'days']) {
      const sorted = filterSort(results, { ...defaults, sort });
      expect(sorted.find((r) => r.item.id === 1).item.v).toBe(false);
      expect(sorted.map((r) => r.item.id)).toEqual(sort === 'high' ? [2, 1] : [1, 2]);
    }
  });
  it('全角半角とかなを吸収する', () => {
    expect(normalize('ﾁｮｺＡＢＣ')).toBe(normalize('ちょこabc'));
    expect(filterSort(run({ n: 'チョコＡＢＣ' }), { ...defaults, q: 'ちょこabc' })).toHaveLength(1);
  });
  it('産地とジャンルの絞り込み、価格・日持ち順を守る', () => {
    const results = scoreItems(
      [
        { ...base, id: 1, d: null, y: 1000 },
        { ...base, id: 2, d: 7, y: 2000 },
        { ...base, id: 3, d: 30, y: 3000 },
      ],
      defaults,
    );
    expect(filterSort(results, { ...defaults, sort: 'days' }).map((r) => r.item.id)).toEqual([
      3, 2, 1,
    ]);
    expect(filterSort(results, { ...defaults, sort: 'low' }).map((r) => r.item.id)).toEqual([
      1, 2, 3,
    ]);
    expect(filterSort(results, { ...defaults, sort: 'high' }).map((r) => r.item.id)).toEqual([
      3, 2, 1,
    ]);
    expect(filterSort(results, { ...defaults, fpref: '京都' })).toEqual([]);
    expect(filterSort(results, { ...defaults, genre: '酒' })).toEqual([]);
  });
});
