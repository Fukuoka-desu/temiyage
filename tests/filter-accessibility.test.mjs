import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = ts.createSourceFile(
  "App.tsx",
  readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const controls = new Map();
function visit(node) {
  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
    const attributes = Object.fromEntries(
      node.attributes.properties
        .filter(
          (attribute) =>
            ts.isJsxAttribute(attribute) &&
            attribute.initializer &&
            ts.isStringLiteral(attribute.initializer),
        )
        .map((attribute) => [attribute.name.text, attribute.initializer.text]),
    );
    if (attributes.id) {
      controls.set(attributes.id, {
        tag: node.tagName.getText(source),
        ...attributes,
      });
    }
  }
  ts.forEachChild(node, visit);
}
visit(source);

it("検索欄と各selectは見出しに依存しないaria-labelを持つ", () => {
  for (const [id, tag, name] of [
    ["search", "input", "品名・店名・県・ジャンルで検索"],
    ["fpref", "select", "産地で絞る"],
    ["genre", "select", "ジャンルで絞る"],
    ["sort", "select", "並べ替え"],
  ]) {
    assert.equal(controls.get(id)?.tag, tag, id);
    assert.equal(controls.get(id)?.["aria-label"], name, id);
  }
});

it("商品詳細と条件パネルの×は閉じるという名前のbuttonで、typeがbutton", () => {
  for (const file of ["ItemDetail.tsx", "App.tsx"]) {
    const component = ts.createSourceFile(
      file,
      readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    let found = 0;
    function check(node) {
      if (ts.isJsxElement(node) && node.children.some(child => ts.isJsxText(child) && child.text.trim() === "×")) {
        const opening = node.openingElement;
        const attributes = Object.fromEntries(opening.attributes.properties
          .filter(attribute => ts.isJsxAttribute(attribute) && attribute.initializer && ts.isStringLiteral(attribute.initializer))
          .map(attribute => [attribute.name.text, attribute.initializer.text]));
        assert.equal(opening.tagName.getText(component), "button", file);
        assert.equal(attributes.type, "button", file);
        assert.equal(attributes["aria-label"], "閉じる", file);
        found++;
      }
      ts.forEachChild(node, check);
    }
    check(component);
    assert.equal(found, 1, file);
  }
});

it("カードは印タグと旧注意欄を持たず、空でも注意1行を確保する", () => {
  const app = source.getFullText();
  const card = app.slice(app.indexOf('<article className="item-card"'), app.indexOf('</article>'));
  assert.doesNotMatch(card, /mark-tags|verification-note|card-cautions/);
  assert.equal((card.match(/className="card-caution"/g) || []).length, 1);
  assert.match(card, /<p className="card-caution" aria-label="注意">\s*\{cardCautionText\(i, cautions\)\}/);
  const detail = readFileSync(new URL("../src/ItemDetail.tsx", import.meta.url), "utf8");
  assert.match(detail, /className="mark-tags"/);
  assert.match(detail, /cautions\.map\(/);
});

it("カードの各行は画面幅ごとの固定高で、注意は13px文字の1行省略", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const fixed = css.slice(css.indexOf('/* Reserve every card field'));
  assert.match(fixed, /grid-template-rows: 18px 106px 18px 100px 18px 74px 20px 66px/);
  assert.match(fixed, /\.card-content \.price \{[^}]*height: 66px;/);
  const mobile = fixed.slice(fixed.indexOf('@media (max-width: 640px)'));
  assert.match(mobile, /grid-template-rows: 18px 106px 18px 107px 18px 74px 20px 66px/);
  assert.match(mobile, /\.card-content \.price \{[^}]*height: 73px;/);
  assert.match(fixed, /\.card-content \.specs \{ height: 30px;[^}]*flex-wrap: nowrap/);
  assert.match(fixed, /\.card-title h3 \{[^}]*height: 62px; line-height: 31px/);
  assert.match(css, /\.card-open-title \{[^}]*-webkit-line-clamp: 2/);
  assert.match(fixed, /\.reasons p \{[^}]*-webkit-line-clamp: 2/);
  const caution = fixed.match(/\.card-content \.card-caution \{([^}]+)\}/)[1];
  for (const rule of ['height: 20px', 'font-size: 13px', 'line-height: 20px', 'white-space: nowrap', 'overflow: hidden', 'text-overflow: ellipsis']) assert.ok(caution.includes(rule), rule);
});
