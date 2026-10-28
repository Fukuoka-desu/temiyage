export interface Item {
  id: number;
  r: string;
  p: string;
  n: string;
  q: string;
  m: string;
  y: number | null;
  d: number | null;
  dr: string;
  st: string;
  sr: string;
  ko: boolean;
  g: string;
  t: string[];
  u: string;
  src: string;
  c: string;
  v: boolean;
  vr: string;
}
export const likeTags: Record<string, string[]> = {
  甘いもの: ['和菓子', '洋菓子', 'チョコ'],
  和菓子: ['和菓子'],
  洋菓子: ['洋菓子'],
  チョコレート: ['チョコ'],
  お酒: ['お酒'],
  'コーヒー・紅茶': ['コーヒー・紅茶'],
  日本茶: ['日本茶'],
  '辛党・おつまみ': ['おつまみ'],
  ご飯のお供: ['ご飯のお供'],
  ヘルシー: ['ヘルシー'],
  果物: ['果物'],
  家族向け: ['個包装'],
};
export const budgets = { b1: [0, 3000], b2: [3000, 5000], b3: [5000, 10000], b4: [10000, Infinity] } as const;
export interface Conditions {
  pref: string;
  mine: string;
  home: 'avoid' | 'nostalgic';
  likes: string[];
  nosweet: boolean;
  keep: boolean;
  budget: keyof typeof budgets;
  use: 'first' | 'apology' | 'thanks' | 'office' | 'celebrate';
  sort: 'recommend' | 'low' | 'high' | 'days';
  fpref: string;
  genre: string;
  q: string;
}
export const defaults: Conditions = {
  pref: '東京',
  mine: '大阪',
  home: 'avoid',
  likes: ['甘いもの'],
  nosweet: false,
  keep: false,
  budget: 'b1',
  use: 'first',
  sort: 'recommend',
  fpref: '',
  genre: '',
  q: '',
};
export interface Result {
  item: Item;
  score: number;
  why: string[];
}
export function scoreItems(items: Item[], c: Conditions): Result[] {
  const results: Result[] = [];
  const [lo, hi] = budgets[c.budget];
  for (const it of items) {
    const has = (tag: string) => (tag === '個包装' ? it.ko : it.t.includes(tag));
    if (c.nosweet && ['和菓子', '洋菓子', 'チョコ'].some(has)) continue;
    if (c.home === 'avoid' && c.pref && it.p === c.pref) continue;
    if (c.keep && it.d !== null && it.d < 7) continue;
    if (it.y === null) continue;
    let score = 0;
    const why: string[] = [];
    const add = (n: number, reason?: string) => {
      score += n;
      if (reason) why.push(reason);
    };
    if (it.y >= lo && it.y <= hi) add(5, '予算内');
    else if (it.y >= (lo * 80) / 100 && it.y <= (hi * 115) / 100) add(1, '予算に近い');
    else continue;
    let hit = 0;
    for (const key of c.likes) {
      if (likeTags[key]?.some(has)) {
        hit++;
        why.push(key === '家族向け' ? '個包装で分けやすい' : `${key}好きに合う`);
      }
    }
    if (c.likes.length && hit === 0) continue;
    score += hit * 4;
    if (c.use === 'first') {
      if (has('個包装')) add(2, '個包装で渡しやすい');
      if (has('定番')) add(2, '定番で外さない');
    }
    if (c.use === 'apology') {
      if (has('和菓子')) add(2);
      if (has('高級感')) add(3, '改まった場に合う');
      if (it.d !== null && it.d >= 30) add(1);
      if (has('お酒')) add(-3);
      if (has('おつまみ')) add(-1);
    }
    if (c.use === 'thanks') {
      if (has('高級感')) add(2, 'お礼にふさわしい格');
      if (has('定番')) add(1);
    }
    if (c.use === 'office') {
      if (has('個包装')) add(4, '人数分に分けやすい');
      else add(-3);
      if (it.d !== null && it.d >= 14) add(1);
    }
    if (c.use === 'celebrate') {
      if (has('お酒')) add(2, 'お祝いの席に合う');
      if (has('高級感')) add(2);
    }
    if (c.keep && it.d !== null && it.d >= 30) add(2, '日持ちする');
    if (c.home === 'nostalgic' && c.pref && it.p === c.pref) {
      score += 8;
      why.unshift('相手の地元の懐かしい味');
    }
    if (c.home === 'avoid' && c.mine && it.p === c.mine) {
      score += 3;
      why.unshift('こちらの土地の名物で話題になる');
    }
    if (it.v) score += 0.5;
    results.push({ item: it, score, why });
  }
  return results.sort(
    (a, b) => Number(b.item.v) - Number(a.item.v) || b.score - a.score || a.item.y! - b.item.y!,
  );
}
export const normalize = (s: string) =>
  s
    .normalize('NFKC')
    .toLocaleLowerCase('ja')
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
export function filterSort(results: Result[], c: Conditions) {
  return results
    .filter(
      ({ item: i }) =>
        (!c.fpref || i.p === c.fpref) &&
        (!c.genre || i.g === c.genre) &&
        normalize([i.n, i.m, i.p, i.q].join(' ')).includes(normalize(c.q)),
    )
    .sort((a, b) =>
      c.sort === 'low'
        ? a.item.y! - b.item.y!
        : c.sort === 'high'
          ? b.item.y! - a.item.y!
          : c.sort === 'days'
            ? (b.item.d ?? -1) - (a.item.d ?? -1)
            : 0,
    );
}
