import { it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ItemImage } from "../.test-build/ItemImage.js";
const item = {
  n: "お菓子",
  g: "和菓子",
  img: "https://example.com/photo.jpg",
  imgsrc: "https://example.com/item",
};
it("写真に遅延読み込み・代替テキスト・公式出典を表示する", () => {
  const html = renderToStaticMarkup(createElement(ItemImage, { item }));
  for (const value of [
    "<img",
    'loading="lazy"',
    'decoding="async"',
    'width="640"',
    'height="400"',
    'referrerPolicy="no-referrer"',
    'alt="お菓子の写真"',
    "画像：公式ページより",
    'href="https://example.com/item"',
    'rel="noopener noreferrer"',
  ])
    assert.ok(html.includes(value), value);
});
it("写真がない品は既存イラストを表示する", () => {
  const html = renderToStaticMarkup(
    createElement(ItemImage, { item: { ...item, img: undefined } }),
  );
  assert.ok(html.includes("<svg"));
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes("画像：公式ページより"));
});
