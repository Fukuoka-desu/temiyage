import { it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { ItemPrice } from "../.test-build/ItemPrice.js";

it("価格不明カードは公式確認の案内だけを表示する", () => {
  for (const v of [true, false]) {
    const html = renderToStaticMarkup(
      createElement(ItemPrice, { item: { y: null, c: "2026-10-28", v } }),
    );
    assert.ok(html.includes("価格は公式ページでご確認ください"));
    assert.ok(!html.includes("円"));
    assert.ok(!html.includes("確認時点"));
  }
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /\(!i.v \|\| i.y === null\) &&/);
  assert.match(app, /badge unverified">要確認/);
});
it("価格のあるカードは金額と確認時点を表示する", () => {
  const html = renderToStaticMarkup(
    createElement(ItemPrice, { item: { y: 3000, c: "2026-10-28" } }),
  );
  assert.ok(html.includes("3,000"));
  assert.ok(html.includes("円（税込）"));
  assert.ok(html.includes("10月28日確認時点・税込"));
});
