import { it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

it("削除した結果一覧の見出し文言がsrcに残っていない", () => {
  const root = new URL("../src/", import.meta.url);
  for (const file of readdirSync(root, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!file.isFile()) continue;
    const source = readFileSync(`${file.parentPath}/${file.name}`, "utf8");
    for (const heading of [
      "あなたの気持ちを届ける候補",
      "こんな手土産はいかが？",
    ]) {
      assert.ok(!source.includes(heading), `${file.name}: ${heading}`);
    }
  }
});
