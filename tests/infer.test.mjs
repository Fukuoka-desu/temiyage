import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { taste, keepDays, drinkTea } from "../.test-build/infer.js";
import {
  defaults,
  scoreItems,
  filterSort,
  relaxationOptions,
} from "../.test-build/score.js";
const data = JSON.parse(
  readFileSync(new URL("../src/data/items.json", import.meta.url), "utf8"),
);
const marks = JSON.parse(
  readFileSync(new URL("../src/data/marks.json", import.meta.url), "utf8"),
);
const find = (name) => {
  const item = data.find((i) => i.n.includes(name));
  assert.ok(item, name);
  return item;
};
const conditions = { ...defaults, likes: [], pref: "", budget: "any" };
const includes = (name, patch) =>
  scoreItems([find(name)], { ...conditions, ...patch }).length === 1;
it("実データから甘味と塩味を区別する", () => {
  for (const name of [
    "北海道開拓おかき",
    "海鮮煎餅",
    "明太せんべい",
    "ザ・カレーサブレ",
    "濃厚3種ごまどうふ",
  ])
    assert.equal(taste(find(name)), "savory", name);
  for (const name of [
    "平治煎餅ショコラ",
    "塩まん",
    "御用邸チーズケーキ",
    "きたかろう(小サイズ)",
    "りんごしろっぷ",
  ])
    assert.equal(taste(find(name)), "sweet", name);
  assert.equal(taste(find("ゆら早生")), null);
});
it("好みと甘いもの苦手に推定を使う", () => {
  for (const name of ["明太せんべい", "海老づくし"])
    assert.equal(includes(name, { likes: ["甘いもの"] }), false);
  assert.ok(includes("きたかろう(小サイズ)", { likes: ["甘いもの"] }));
  assert.ok(includes("海鮮煎餅", { nosweet: true }));
  assert.equal(includes("りんごしろっぷ", { nosweet: true }), false);
  assert.ok(includes("北海道開拓おかき", { likes: ["辛党・おつまみ"] }));
  assert.equal(includes("星空舞糀甘酒", { likes: ["お酒"] }), false);
  assert.ok(includes("伊勢茶 ティーバッグ", { likes: ["日本茶"] }));
  assert.equal(
    includes("はちみつ紅茶とバウムセット", { likes: ["日本茶"] }),
    false,
  );
  assert.ok(drinkTea(find("喜久水庵銘茶ギフト")).western);
  assert.equal(includes("ピー入り柿の種", { likes: ["ヘルシー"] }), false);
  for (const name of [
    "佐賀牛 ももスライス",
    "三河つくだ煮ギフト 花梨",
    "阿闍梨餅",
  ])
    assert.equal(includes(name, { likes: ["果物"] }), false);
  assert.ok(includes("乃し梅", { likes: ["果物"] }));
  for (const name of [
    "ゆら早生",
    "彩果の宝石 プレミアムゼリーコレクション PC18",
    "果恋",
  ])
    assert.ok(includes(name, { likes: ["果物"] }), name);
  for (const name of ["グーテ・デ・ロワ カカオ", "ミ・キュイカカオ"])
    assert.ok(includes(name, { likes: ["チョコレート"] }));
});
it("日持ちの文章を最小日数にし、不明は注意付きで残す", () => {
  for (const [name, days] of [
    ["さわ餅", 0],
    ["末廣饅頭", 4],
    ["きんつば", 10],
  ]) {
    if (name !== "きんつば")
      assert.deepEqual(keepDays(find(name)), { days, source: "text" });
    if (days < 7) assert.equal(includes(name, { keep: true }), false);
  }
  const item = { ...find("さわ餅"), d: null, dr: "", n: "不明な品" };
  const results = scoreItems([item], { ...conditions, keep: true });
  assert.equal(results.length, 1);
  assert.equal(results[0].tier, 1);
  assert.ok(
    results[0].cautions.includes("日持ちは未確認です。購入前にご確認ください"),
  );
  for (const [dr, days] of [
    ["製造より冬期(10~5月)14日・夏期(6~9月)10日", 10],
    ["25(製造日より・4月/10月)", 25],
    ["15(6~10月)/25(11~5月)", 15],
  ])
    assert.equal(keepDays({ ...item, dr }).days, days);
});
it("全並び順・検索でも予算内と確認できた品を予算外より先にする", () => {
  for (const sort of ["recommend", "low", "high", "days"]) {
    const c = { ...defaults, sort };
    const results = filterSort(scoreItems(data, c), c);
    let outside = false;
    for (const r of results) {
      if (r.item.y > 3000) outside = true;
      else assert.equal(outside, false);
    }
    const pair = [
      { ...find("さわ餅"), y: 2000, v: false },
      { ...find("末廣饅頭"), y: 3300, v: true },
    ];
    const search = { ...conditions, budget: "b1", sort, q: "餅 饅頭" };
    // 検索に両方当たる品名で、検索点より段が優先されることを確認。
    const named = pair.map((i) => ({ ...i, n: "餅 饅頭" }));
    assert.equal(filterSort(scoreItems(named, search), search)[0].item.y, 2000);
  }
});
it("晩酌の印は確認済みより先に評価する", () => {
  const c = { ...conditions, traits: ["banshaku"] };
  const results = filterSort(scoreItems(data, c), c);
  assert.equal(results.slice(0, 10).length, 10);
  assert.ok(results.slice(0, 10).every((r) => marks[r.item.id]?.banshaku));
});
it("解除案は増えるものだけ件数順に最大6件、予算指定も解除できる", () => {
  const c = {
    ...conditions,
    likes: ["甘いもの", "お酒"],
    budget: "b1",
    q: "存在しない",
  };
  const options = relaxationOptions(data, c);
  assert.ok(options.length <= 6);
  assert.ok(
    options.every(
      (o, index) =>
        o.count > 0 && (!index || options[index - 1].count >= o.count),
    ),
  );
  const budgetOptions = relaxationOptions([{ ...find("さわ餅"), y: 9000 }], {
    ...conditions,
    budget: "b1",
  });
  assert.ok(budgetOptions.some((o) => o.label === "予算を指定しない"));
  // 好みはOR条件のため、一つ外しても件数は増えない。増えない案を表示しない。
  assert.ok(options.every((o) => !/^好み『/.test(o.label)));
});
it("初期画面の候補数の変化は甘味判定によるものだけ", () => {
  const before = data.filter(
    (i) =>
      i.p !== "東京" &&
      i.y !== null &&
      i.y <= 3450 &&
      i.t.some((t) => ["和菓子", "洋菓子", "チョコ"].includes(t)),
  );
  const after = scoreItems(data, defaults);
  console.log(
    `初期画面: ${before.length}件 → ${after.length}件（甘味判定を改善）`,
  );
  for (const i of before.filter((i) => !after.some((r) => r.item.id === i.id)))
    assert.notEqual(taste(i), "sweet");
});
