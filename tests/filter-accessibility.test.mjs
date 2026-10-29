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
