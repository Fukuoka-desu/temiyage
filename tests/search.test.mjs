import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalize,
  searchScore,
  searchWords,
  searchSuggestions,
} from "../.test-build/search.js";
import { defaults, filterSort } from "../.test-build/score.js";
const base = {
  id: 1,
  n: "羊羹",
  m: "六花亭",
  p: "福岡",
  r: "九州・沖縄",
  g: "和菓子",
  t: ["定番"],
  q: "1箱",
  y: 2000,
  d: 30,
  v: true,
};
const item = (patch = {}) => ({ ...base, ...patch });
const result = (patch = {}) => ({
  item: item(patch),
  score: 0,
  why: [],
  cautions: [],
});
const score = (i, q) => searchScore(i, searchWords(q));
const ids = (rows, conditions = {}) =>
  filterSort(rows, { ...defaults, ...conditions }).map((r) => r.item.id);

describe("検索", () => {
  it("カナ・幅・大小・長音・記号を同じ表記にする", () => {
    assert.equal(
      normalize("ﾏﾙｾｲ・バターサンド ＡＢＣ"),
      normalize("まるせいばたさんどabc"),
    );
    assert.equal(normalize("〜･-_／/()「」!?&。、"), "");
    assert.notEqual(score(item({ n: "カステラ" }), "かすてーら"), null);
    assert.notEqual(
      score(item({ n: "マルセイ バターサンド" }), "マルセイ・バターサンド"),
      null,
    );
  });
  it("全角空白も含む全語ANDで項目をまたいで照合する", () => {
    assert.notEqual(score(base, "福岡　ようかん"), null);
    assert.equal(score(base, "福岡 京都"), null);
    assert.notEqual(score(base, "福岡 お菓子"), null);
    assert.notEqual(score(item({ p: "京都" }), "京都　和菓子"), null);
  });
  it("品名・店名・県の順で重く、先頭や記号直後を加点する", () => {
    const rows = [
      result({ id: 1, n: "別の品", p: "京都" }),
      result({ id: 2, n: "別の品", m: "京都店" }),
      result({ id: 3, n: "京都の菓子", y: null, v: false }),
    ];
    assert.deepEqual(ids(rows, { q: "京都" }), [3, 2, 1]);
    assert.ok(
      score(item({ n: "羊羹セット" }), "羊羹") >
        score(item({ n: "特製羊羹" }), "羊羹"),
    );
    assert.ok(
      score(item({ n: "特製・羊羹" }), "羊羹") >
        score(item({ n: "特製羊羹" }), "羊羹"),
    );
    assert.ok(
      score(item({ m: "京都店" }), "京都") >
        score(item({ m: "特製京都店" }), "京都"),
    );
    assert.ok(
      score(item({ n: "ようかん" }), "ようかん") > score(base, "ようかん"),
    );
    assert.equal(
      score(base, "福岡 羊羹"),
      score(base, "福岡") + score(base, "羊羹"),
    );
  });
  it("地名・地方・ジャンル・読みを展開し、日本酒に梅酒を混ぜない", () => {
    assert.notEqual(score(base, "博多"), null);
    assert.notEqual(score(base, "九州"), null);
    assert.notEqual(score(base, "ようかん"), null);
    assert.notEqual(score(item({ n: "羊羹詰合せ" }), "ようかん詰合せ"), null);
    assert.equal(score(base, "博"), null);
    assert.notEqual(score(item({ n: "純米吟醸", g: "酒" }), "お酒"), null);
    assert.notEqual(score(item({ n: "純米吟醸", g: "酒" }), "日本酒"), null);
    for (const n of [
      "梅酒",
      "ワイン",
      "ビール",
      "日本酒仕込み梅酒",
      "リキュール",
    ])
      assert.equal(score(item({ n, g: "酒" }), "日本酒"), null);
    assert.notEqual(
      score(item({ n: "バウムクーヘン" }), "バームクーヘン"),
      null,
    );
    assert.equal(score(base, "東北"), null);
    assert.notEqual(
      score(item({ p: "宮城", r: "北海道・東北" }), "東北"),
      null,
    );
  });
  it("北海道は東北6県に一致せず、地方名は対応する地域に一致する", () => {
    for (const p of ["青森", "岩手", "宮城", "秋田", "山形", "福島"]) {
      const tohoku = item({ p, r: "北海道・東北", n: "チョコままどおる" });
      assert.equal(score(tohoku, "北海道"), null);
      assert.equal(score(tohoku, "北海道 チョコ"), null);
      assert.notEqual(score(tohoku, "東北"), null);
    }
    assert.notEqual(
      score(
        item({ p: "北海道", r: "北海道・東北", n: "チョコ" }),
        "北海道 チョコ",
      ),
      null,
    );
    for (const [q, p, r] of [
      ["九州", "福岡", "九州・沖縄"],
      ["関東", "東京", "関東"],
      ["中部", "愛知", "中部"],
      ["関西", "京都", "近畿"],
      ["近畿", "京都", "近畿"],
      ["中国", "広島", "中国・四国"],
      ["四国", "愛媛", "中国・四国"],
      ["北陸", "石川", "中部"],
    ])
      assert.notEqual(score(item({ p, r }), q), null, q);
    assert.equal(score(item({ p: "東京", r: "関東" }), "関"), null);
  });
  it("焼きの送りがなをそろえ、どら焼の表記で同じ結果を返す", () => {
    assert.equal(normalize("焼き菓子"), normalize("焼菓子"));
    const rows = [
      result({ id: 1, n: "栗どら焼" }),
      result({ id: 2, n: "胡麻どら焼" }),
      result({ id: 3, n: "どら焼き" }),
      result({ id: 4, n: "羊羹" }),
    ];
    for (const q of ["ドラ焼き", "どらやき", "どら焼"]) {
      assert.equal(ids(rows, { q }).length, 3);
      assert.deepEqual(new Set(ids(rows, { q })), new Set([1, 2, 3]));
    }
  });
  it("バウムだけの品名もバウムクーヘンの表記ゆれから検索できる", () => {
    for (const n of [
      "チーズバウム(ホール)",
      "金谷ハードバウム",
      "おいもバウム",
    ])
      for (const q of ["バウムクーヘン", "バームクーヘン", "ばうむくーへん"])
        assert.notEqual(score(item({ n }), q), null, `${q}: ${n}`);
  });
  it("めんたい・明太とマンジュも読みの言い換えに含める", () => {
    for (const q of ["明太子", "めんたいこ", "めんたい", "明太"])
      for (const n of ["味のめんたいマヨ", "明太子", "めんたいこ", "明太"])
        assert.notEqual(score(item({ n }), q), null, `${q}: ${n}`);
    assert.notEqual(score(item({ n: "スイーツマンジュ" }), "まんじゅう"), null);
  });
  it("空の検索は従来順、同点は価格不明・確認済み優先と入力順を保つ", () => {
    const rows = [
      result({ id: 1, y: null }),
      result({ id: 2, v: false }),
      result({ id: 3 }),
      result({ id: 4 }),
    ];
    assert.deepEqual(ids(rows), [3, 4, 2, 1]);
    assert.deepEqual(ids(rows, { q: "　 " }), ids(rows));
    assert.deepEqual(ids(rows, { q: "羊羹" }), [3, 4, 2, 1]);
    assert.deepEqual(
      rows.map((r) => r.item.id),
      [1, 2, 3, 4],
    );
  });
  it("価格順・日持ち順には検索点を反映しない", () => {
    const rows = [
      result({ id: 1, n: "羊羹", y: 3000, d: 10 }),
      result({ id: 2, n: "特製羊羹", y: 1000, d: 50 }),
    ];
    assert.deepEqual(ids(rows, { q: "羊羹", sort: "low" }), [2, 1]);
    assert.deepEqual(ids(rows, { q: "羊羹", sort: "high" }), [1, 2]);
    assert.deepEqual(ids(rows, { q: "羊羹", sort: "days" }), [2, 1]);
  });
  it("全品で合う語なら候補を出さない", () => {
    const items = [base, item({ id: 2, n: "純米吟醸", g: "酒" })];
    for (const q of ["日本酒", "六花亭", "ようかん", "福岡 羊羹"])
      assert.deepEqual(searchSuggestions(items, q), [], q);
  });
  it("全品で0件の打ち間違い（六化亭）なら六花亭を出す", () => {
    assert.equal(score(base, "六化亭"), null);
    assert.ok(searchSuggestions([base], "六化亭").includes("六花亭"));
  });
  it("候補は重複せず最大5語にし、空の検索や近い語がない検索には出さない", () => {
    const suggestions = searchSuggestions([base, base], "六化亭");
    assert.ok(suggestions.length <= 5);
    assert.equal(new Set(suggestions).size, suggestions.length);
    assert.deepEqual(searchSuggestions([base], "　"), []);
    assert.deepEqual(searchSuggestions([base], "全く存在しない長い文字列"), []);
  });
});
