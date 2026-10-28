import { describe, it } from "node:test";
import { expect } from "./assert.mjs";
import { readFileSync } from "node:fs";
const data = JSON.parse(
  readFileSync(new URL("../src/data/items.json", import.meta.url), "utf8"),
);
import {
  defaults as appDefaults,
  filterSort,
  normalize,
  relaxationOptions,
  scoreItems,
} from "../.test-build/score.js";
// 既存の用途別スコアは、贈り手を大阪に明示した条件で検証する。
const defaults = { ...appDefaults, mine: "大阪" };
const base = {
  id: 1,
  r: "近畿",
  p: "大阪",
  n: "テスト",
  q: "1箱",
  m: "メーカー",
  y: 2000,
  d: 30,
  dr: "30日",
  st: "",
  sr: "",
  ko: true,
  g: "和菓子",
  t: ["和菓子", "定番", "高級感"],
  u: "https://example.com",
  src: "公式",
  c: "2026-10-28",
  v: true,
  vr: "",
};
const run = (patch = {}, conditions = {}) =>
  scoreItems(
    [{ ...base, ...patch }],
    { ...defaults, mine: "大阪", ...conditions },
    {},
  );
describe("スコアと除外条件", () => {
  it("未指定の土地は東京として加点し、相手の出身地の除外を優先する", () => {
    expect(appDefaults.mine).toBe("");
    const conditions = { ...appDefaults, pref: "京都" };
    const tokyo = { ...base, p: "東京" };
    const result = scoreItems([tokyo], conditions, {})[0];
    expect(result.score).toBe(16.5);
    expect(result.why[0]).toBe("こちらの土地の名物で話題になる");
    expect(scoreItems([tokyo], appDefaults, {})).toEqual([]);
    expect(
      scoreItems([base], { ...appDefaults, pref: "大阪", mine: "大阪" }, {}),
    ).toEqual([]);
    expect(scoreItems([tokyo], { ...conditions, mine: "東京" }, {})).toEqual(
      scoreItems([tokyo], conditions, {}),
    );
  });
  it("ご挨拶・訪問・甘いもの・贈り手の土地を加点する", () => {
    expect(run()[0].score).toBe(16.5);
    expect(run()[0].why[0]).toBe("こちらの土地の名物で話題になる");
  });
  it("価格未記載、苦手、相手の地元、短い日持ちを除く", () => {
    expect(run({ y: null })).toEqual([]);
    expect(run({}, { nosweet: true })).toEqual([]);
    expect(run({ p: "東京" })).toEqual([]);
    expect(run({ d: 6 }, { keep: true })).toEqual([]);
    expect(run({ d: null }, { keep: true })).toHaveLength(1);
  });
  it("予算境界・許容範囲の端を含む", () => {
    expect(run({ y: 3000 })).toHaveLength(1);
    expect(run({ y: 3450 })[0].why).toContain("予算に近い");
    expect(run({ y: 3451 })).toEqual([]);
    expect(run({ y: 2400 }, { budget: "b2" })).toHaveLength(1);
    expect(run({ y: 2399 }, { budget: "b2" })).toEqual([]);
    expect(run({ y: 100000 }, { budget: "b4" })).toHaveLength(1);
  });
  it("好みのヒット数と個包装列による家族向けを評価する", () => {
    expect(run({}, { likes: ["和菓子", "家族向け"] })[0].score).toBe(20.5);
    expect(run({}, { likes: ["果物"] })).toEqual([]);
    expect(run({}, { likes: [] })).toHaveLength(1);
    expect(run({}, { likes: ["家族向け"] })[0].why).toContain(
      "個包装で分けやすい",
    );
  });
  it("懐かしい地元は最初の理由になり8点を加点する", () => {
    const result = run({ p: "東京" }, { home: "nostalgic" })[0];
    expect(result.why[0]).toBe("相手の地元の懐かしい味");
    expect(result.score).toBe(21.5);
  });
  for (const [use, score] of [
    ["apology", 18.5],
    ["thanks", 15.5],
    ["office", 17.5],
    ["celebrate", 14.5],
  ])
    it(`${use} の用途別スコア`, () =>
      expect(run({}, { use })[0].score).toBe(score));
  it("お詫びのお酒・おつまみの減点と職場の個包装なしを計算する", () => {
    expect(
      run(
        { t: ["お酒", "おつまみ"], ko: false },
        { likes: [], use: "apology" },
      )[0].score,
    ).toBe(5.5);
    expect(run({ ko: false }, { use: "office" })[0].score).toBe(10.5);
  });
  it("日持ち重視で30日以上に加点する", () => {
    expect(run({}, { keep: true })[0].score).toBe(18.5);
  });
  it("低スコアの確認済みも要確認より前、同点は安い順", () => {
    const result = scoreItems(
      [
        { ...base, id: 1, v: false },
        { ...base, id: 2, t: ["和菓子"], ko: false, y: 2500 },
        { ...base, id: 3, t: ["和菓子"], ko: false, y: 2000 },
      ],
      defaults,
    );
    expect(result.map((r) => r.item.id)).toEqual([3, 2, 1]);
  });
});
describe("実データ・表示絞り込み", () => {
  it("収録数と欠損値を保持する", () => {
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((i) => typeof i.v === "boolean")).toBe(true);
    expect(data.every((i) => i.y === null || Number.isFinite(i.y))).toBe(true);
    expect(data.every((i) => i.d === null || Number.isFinite(i.d))).toBe(true);
    expect(data.every((i) => !i.u || /^https?:\/\//i.test(i.u))).toBe(true);
  });
  it("初期候補の上位12件は確認済み", () => {
    const results = scoreItems(data, defaults);
    expect(results.length).toBeGreaterThan(12);
    expect(results.slice(0, 12).every((r) => r.item.v)).toBe(true);
  });
  it("全ての並び順で確認済みが残っているのに要確認が先に出ない", () => {
    const results = scoreItems(
      [
        { ...base, id: 1, v: false, y: 1000, d: 90 },
        { ...base, id: 2, t: ["和菓子"], ko: false, y: 3000, d: 7 },
      ],
      defaults,
    );
    expect(filterSort(results, defaults).map((r) => r.item.id)).toEqual([2, 1]);
    for (const sort of ["low", "high", "days"]) {
      const sorted = filterSort(results, { ...defaults, sort });
      expect(sorted.find((r) => r.item.id === 1).item.v).toBe(false);
      expect(sorted.map((r) => r.item.id)).toEqual([2, 1]);
    }
  });
  it("全角半角とかなを吸収する", () => {
    expect(normalize("ﾁｮｺＡＢＣ")).toBe(normalize("ちょこabc"));
    expect(
      filterSort(run({ n: "チョコＡＢＣ" }), { ...defaults, q: "ちょこabc" }),
    ).toHaveLength(1);
  });
  it("産地とジャンルの絞り込み、価格・日持ち順を守る", () => {
    const results = scoreItems(
      [
        { ...base, id: 1, d: null, y: 1000 },
        { ...base, id: 2, d: 7, y: 2000 },
        { ...base, id: 3, d: 30, y: 3000 },
      ],
      defaults,
    );
    expect(
      filterSort(results, { ...defaults, sort: "days" }).map((r) => r.item.id),
    ).toEqual([3, 2, 1]);
    expect(
      filterSort(results, { ...defaults, sort: "low" }).map((r) => r.item.id),
    ).toEqual([1, 2, 3]);
    expect(
      filterSort(results, { ...defaults, sort: "high" }).map((r) => r.item.id),
    ).toEqual([3, 2, 1]);
    expect(filterSort(results, { ...defaults, fpref: "京都" })).toEqual([]);
    expect(filterSort(results, { ...defaults, genre: "酒" })).toEqual([]);
  });
});

describe("人柄・関係・職場の印", () => {
  const marked = {
    1: {
      sweets: "ジャンル=和菓子",
      bigfamily: "内容量の数=12",
      casual: "税込価格(円)=2000",
      office: "個包装=有・内容量の数=12",
    },
  };
  it("人柄は各3点加点し、理由の先頭に置く。当たらない品も残す", () => {
    const c = { ...defaults, traits: ["sweets", "bigfamily", "tea"] };
    const result = scoreItems([base], c, marked)[0];
    expect(result.score).toBe(run()[0].score + 6);
    expect(result.why[0]).toBe("甘党の方に（ジャンル=和菓子）");
    expect(result.why[1]).toBe("家族が多い方に（内容量の数=12）");
    expect(scoreItems([base], c, {})).toHaveLength(1);
  });
  it("関係の加点と減点を適用し、候補は除外しない", () => {
    for (const [rel, delta] of [
      ["business", -2],
      ["casual", 3],
    ]) {
      const result = scoreItems([base], { ...defaults, rel }, marked)[0];
      expect(result.score).toBe(run()[0].score + delta);
    }
    expect(
      scoreItems([base], { ...defaults, rel: "casual" }, {})[0].score,
    ).toBe(run()[0].score - 1);
    expect(
      scoreItems(
        [base],
        { ...defaults, rel: "business" },
        { 1: { business: "税込価格(円)=3000" } },
      )[0].score,
    ).toBe(run()[0].score + 3);
  });
  it("officeは既存の個包装加点に4点を追加する", () => {
    const result = scoreItems(
      [base],
      { ...defaults, use: "office" },
      marked,
    )[0];
    expect(result.score).toBe(run({}, { use: "office" })[0].score + 4);
    expect(result.why).toContain("人数分に分けやすい（個包装・数量）");
  });
});

describe("時期と用途の並び順・注意", () => {
  const pair = [
    { ...base, id: 1 },
    { ...base, id: 2 },
  ];
  const conditions = { ...defaults, likes: [], use: "thanks" };
  for (const [season, mark, reason] of [
    ["chugen", "summer_fit", "夏の贈り物に合う"],
    ["oseibo", "winter_fit", "冬の贈り物に合う"],
    ["onenga", "newyear_fit", "新年のご挨拶に合う"],
  ]) {
    it(`${season}で合う品が先になり理由を表示する`, () => {
      const marks = { 2: { [mark]: "根拠" } };
      expect(scoreItems(pair, conditions, marks).map((r) => r.item.id)).toEqual(
        [1, 2],
      );
      const result = scoreItems(pair, { ...conditions, season }, marks);
      expect(result.map((r) => r.item.id)).toEqual([2, 1]);
      expect(result[0].why).toContain(reason);
    });
  }
  for (const [patch, mark, delta, warnings] of [
    [{ season: "chugen" }, "summer_caution", -4, 1],
    [{ season: "onenga" }, "short_keep", -2, 0],
    [{ use: "apology" }, "alcohol", -3, 1],
    [{ use: "apology" }, "flashy", -3, 1],
    [{ use: "apology" }, "classic_sweets", 3, 0],
    [{ use: "mimai" }, "alcohol", -5, 1],
    [{ use: "mimai" }, "short_keep", 0, 1],
    [{ use: "mimai" }, "elderly", 2, 0],
    [{ use: "office" }, "short_keep", -2, 0],
    [{ use: "souvenir" }, "easy_share", 2, 0],
  ]) {
    it(`${JSON.stringify(patch)}・${mark}で加減点と注意が変わる`, () => {
      const c = { ...conditions, ...patch };
      const plain = scoreItems(pair, c, {});
      const marked = scoreItems(pair, c, { 1: { [mark]: "根拠" } });
      const item = marked.find((r) => r.item.id === 1);
      expect(item.score).toBe(plain[0].score + delta);
      expect(item.cautions.length).toBe(warnings);
      expect(marked.length).toBe(2);
      expect(marked[0].item.id).toBe(delta < 0 ? 2 : 1);
    });
  }
  it("帰省・旅行は7日以上と3000円以下にそれぞれ加点する", () => {
    const c = { ...conditions, use: "souvenir" };
    const score = (d, y) => scoreItems([{ ...base, d, y }], c, {})[0].score;
    expect(score(7, 3000)).toBe(score(6, 3000) + 1);
    expect(score(7, 3000)).toBe(score(7, 2999));
    const item = { ...base, y: 3000, d: 7 };
    expect(scoreItems([item], c, {})[0].score).toBe(
      scoreItems([item], { ...c, use: "mimai" }, {})[0].score + 2,
    );
  });
  it("複数の注意を保持し、季節を問わない場合には夏の注意を出さない", () => {
    const marks = {
      1: { alcohol: "酒", summer_caution: "冷蔵", short_keep: "3日" },
    };
    expect(
      scoreItems(
        [base],
        { ...conditions, use: "mimai", season: "chugen" },
        marks,
      )[0].cautions.length,
    ).toBe(3);
    expect(scoreItems([base], conditions, marks)[0].cautions).toEqual([]);
  });
});

it("空白区切りANDはフィールド・入力順を問わず、空白のみは未指定", () => {
  const results = run({ n: "チョコＡＢＣ", m: "京都メーカー" });
  for (const q of ["　ちょこabc　", "京都 ﾁｮｺABC", "ﾁｮｺABC 京都", "　 "]) {
    expect(filterSort(results, { ...defaults, q })).toHaveLength(1);
  }
  expect(
    filterSort(results, { ...defaults, q: "京都 存在しない" }),
  ).toHaveLength(0);
});
it("緩和案は増えるものだけ実件数付きで返す", () => {
  const c = { ...defaults, fpref: "東京" };
  const options = relaxationOptions([base], c);
  expect(options.map((o) => o.label)).toEqual(["産地の指定を解除"]);
  expect(options[0].count).toBe(1);
  expect(relaxationOptions([base], { ...c, q: "存在しない" })).toEqual([]);
});

it("指定しないは予算理由を付けず、不明価格は全並び順で価格ありのあと", () => {
  const items = [
    { ...base, id: 1, y: null, v: true },
    { ...base, id: 2, y: 50000, v: false },
    { ...base, id: 3, y: null, v: false },
    { ...base, id: 4, y: 2000, v: true },
  ];
  for (const sort of ["low", "high", "recommend", "days"]) {
    const c = { ...defaults, budget: "any", sort };
    const result = filterSort(scoreItems(items, c, {}), c);
    expect(result.map((r) => r.item.id)).toEqual([4, 2, 1, 3]);
    expect(result.every((r) => Number.isFinite(r.score))).toBe(true);
    expect(
      result.every((r) => !r.why.some((why) => why.includes("予算"))),
    ).toBe(true);
  }
});
it("b4とanyの0件緩和は予算を下げず、価格不明の追加を提案できる", () => {
  for (const budget of ["b4", "any"]) {
    const c = { ...defaults, budget };
    const options = relaxationOptions([{ ...base, y: null }], c);
    expect(options.some((o) => o.label === "予算を一段上げる")).toBe(false);
    if (budget === "b4")
      expect(options.some((o) => o.label === "価格不明の品も含める")).toBe(
        true,
      );
  }
});
