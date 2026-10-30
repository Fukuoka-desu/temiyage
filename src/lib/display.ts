import type { Item } from "./score";

export function shopShelfText(raw: string) {
  const text = raw.trim();
  return /[0-9０-９]$/.test(text) ? `${text}日` : text;
}

export function shelfLabel(item: Item, details = false) {
  const summary = item.d !== null ? `約${item.d}日` : "日持ちは不明";
  const raw = shopShelfText(item.dr);
  return details && raw && raw !== "不明" ? `${summary}（お店の表記：${raw}）` : summary;
}

export function prefectureLabel(raw: string) {
  const name = raw.trim();
  if (name === "京都") return "京都府";
  if (!name || /[都道府県]$/.test(name)) return name;
  return name + (name === "東京" ? "都" : name === "京都" || name === "大阪" ? "府" : "県");
}

export function storageLabel(item: Item) {
  const raw = item.sr.trim();
  if (raw && raw !== "不明") return raw;
  return item.st && item.st !== "不明" ? item.st : "保存方法は不明（購入前にご確認ください）";
}
