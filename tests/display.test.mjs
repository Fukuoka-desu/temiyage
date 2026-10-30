import { it } from "node:test";
import assert from "node:assert/strict";
import { shopShelfText, shelfLabel, prefectureLabel, storageLabel } from "../.test-build/display.js";

it("日持ちは表示だけ補足し、既存の単位や不明を保つ", () => {
  const item = { d: 8, dr: "製造日翌日より8" };
  assert.equal(shelfLabel(item, true), "約8日（お店の表記：製造日翌日より8日）");
  assert.equal(item.dr, "製造日翌日より8");
  assert.equal(shopShelfText("製造日より８ "), "製造日より８日");
  assert.equal(shopShelfText("8日間"), "8日間");
  assert.equal(shelfLabel({ d: null, dr: "不明" }, true), "日持ちは不明");
  assert.equal(shelfLabel({ d: null, dr: "" }), "日持ちは不明");
});
it("都道府県の接尾辞を重ねず、保存方法不明を案内する", () => {
  for (const [raw, label] of [["福島", "福島県"], ["東京", "東京都"], ["京都", "京都府"], ["大阪", "大阪府"], ["北海道", "北海道"], ["福島県", "福島県"]]) assert.equal(prefectureLabel(raw), label);
  for (const sr of ["", "不明", " 不明 "]) assert.equal(storageLabel({ st: "", sr }), "保存方法は不明（購入前にご確認ください）");
  assert.equal(storageLabel({ st: "", sr: "常温" }), "常温");
  assert.equal(storageLabel({ st: "要冷蔵", sr: "要冷蔵・10℃以下" }), "要冷蔵・10℃以下");
});

it("カード注意は空欄・1件・複数件・価格未確認を1つの要約にする", async () => {
  const { cardCautionText } = await import("../.test-build/display.js");
  const item = { v: true, y: 1000 };
  assert.equal(cardCautionText(item, []), "");
  assert.equal(cardCautionText(item, ["冷蔵"]), "注意：冷蔵");
  const notes = ["冷蔵", "日持ちが短い"];
  assert.equal(cardCautionText(item, notes), "注意：冷蔵・ほか");
  assert.deepEqual(notes, ["冷蔵", "日持ちが短い"]);
  for (const unknown of [{ v: false, y: 1000 }, { v: true, y: null }]) {
    assert.equal(cardCautionText(unknown, []), "注意：価格・販売状況は購入前に販売元へご確認ください");
    assert.equal(cardCautionText(unknown, notes), "注意：価格・販売状況は購入前に販売元へご確認ください・ほか");
  }
});
