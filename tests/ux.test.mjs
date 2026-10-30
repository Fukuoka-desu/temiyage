import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaults, scoreItems, filterSort, budgetSteps } from "../.test-build/score.js";
import { readConditions, readItemId, writeConditions, writeItemId } from "../.test-build/url.js";
const items = JSON.parse(readFileSync(new URL("../src/data/items.json", import.meta.url)));
it("好み初期値は空で、日本酒の検索は甘いものの好みがあっても見つかる", () => {
  globalThis.location = { search: "" };
  assert.deepEqual(defaults.likes, []);
  assert.deepEqual(readConditions([], []).likes, []);
  for (const likes of [[], ["甘いもの"]]) {
    const c = { ...defaults, likes, q: "日本酒" };
    assert.ok(filterSort(scoreItems(items, c), c).length > 0);
  }
});
it("写真なし・読み込み失敗は同じ確認状態と価格区分の後方に並ぶ", () => {
  const base = items.find(i => i.v && i.y !== null);
  const c = { ...defaults, pref: "", budget: "any" };
  const data = [{ ...base, id: 1, img: undefined }, { ...base, id: 2, img: "https://example.com/a" }, { ...base, id: 3, img: "https://example.com/b" }];
  const results = scoreItems(data, c);
  assert.deepEqual(filterSort(results, c).map(r => r.item.id), [2, 3, 1]);
  assert.equal(filterSort(results, c, new Set([2]))[0].item.id, 3);
  for (const ko of [false, null]) assert.equal(scoreItems([{ ...base, ko }], { ...c, likes: ["家族向け"] }).length, 0);
});
it("item URLを条件とともに復元・保持し、閉じるとitemだけ外す", () => {
  globalThis.location = new URL("https://example.com/gift/?item=12&budget=any&pu=1&use=first");
  let written;
  globalThis.history = { replaceState: (_a, _b, url) => { written = url; }, pushState: (_a, _b, url) => { written = url; } };
  assert.equal(readItemId(), 12);
  const c = readConditions([], []);
  assert.equal(c.use, "visit");
  writeConditions(c);
  assert.equal(new URL(written, location).searchParams.get("item"), "12");
  writeItemId(null);
  const url = new URL(written, location);
  assert.equal(url.searchParams.has("item"), false);
  assert.equal(url.searchParams.get("budget"), "any");
  assert.equal(url.searchParams.get("pu"), "1");
});
it("通常価格帯の予算刻みは100円、上限なしも選べる", () => {
  for (let i = 1; budgetSteps[i] <= 6000; i++) assert.equal(budgetSteps[i] - budgetSteps[i - 1], 100);
  assert.equal(budgetSteps.at(-1), Infinity);
});
