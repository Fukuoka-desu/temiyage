import type { Item } from "./score";

// データの値は変えず、品名・店名・ジャンル・タグ・内容量・日持ちの文章から当てる。
const sweets = ["和菓子", "洋菓子", "チョコ"];
const fruitWords =
  /いちご|苺|りんご|林檎|アップル|みかん|蜜柑|レモン|檸檬|柚子|ゆず|柚|ぶどう|葡萄|梅(?!乃宿)|桃|メロン|フルーツ|果実|果樹|あまおう|日向夏|パイン|鳳梨|さくらんぼ|無花果|いちじく|ラズベリー|オレンジ|柑/;

export function taste(item: Item): "sweet" | "savory" | null {
  const candy = sweets.includes(item.g);
  if (
    ((candy &&
      /おかき|あられ|柿の種|海鮮煎餅|えびせん|海老|赤えび|えびチーズ|明太|めんたい|ふぐ煎餅|辛マヨ|カレー/.test(
        item.n,
      )) ||
      /みそたれ|醤油たれ/.test(item.q)) &&
    !/チョコ|ショコラ|饅頭|まん/.test(item.n)
  )
    return "savory";
  if (["おつまみ", "ご飯のお供"].includes(item.g)) return "savory";
  if (candy || sweets.some((tag) => item.t.includes(tag))) return "sweet";
  if (
    item.g === "その他" &&
    (/シロップ|しろっぷ|バウム|羊羹|もなか|最中|饅頭|ケーキ|クッキー|チョコ/.test(
      item.n,
    ) ||
      [
        "チョコ",
        "マドレーヌ",
        "クッキー",
        "ブッセ",
        "パイ",
        "ケーキ",
        "バウム",
        "フィナンシェ",
      ].filter((word) => item.q.includes(word)).length >= 2)
  )
    return "sweet";
  return null;
}

export function isAlcohol(item: Item): boolean {
  return item.g === "酒" && !/甘酒/.test(item.n + item.q);
}

export function drinkTea(item: Item): { japanese: boolean; western: boolean } {
  if (sweets.includes(item.g)) return { japanese: false, western: false };
  const black = /紅茶/.test(item.n + item.q);
  return {
    japanese:
      /煎茶|玉露|ほうじ茶|緑茶|伊勢茶|銘茶|茶葉|抹茶/.test(item.n) ||
      (item.g === "茶" && !black),
    western: black || /珈琲|コーヒー/.test(item.n + item.q),
  };
}

export function isHealthy(item: Item): boolean {
  return (
    item.t.includes("ヘルシー") &&
    !/ナッツ|ピーナッツ|柿の種|パイ|ロール/.test(item.n)
  );
}

export function isFruit(item: Item): boolean {
  return (
    !isAlcohol(item) &&
    (item.g === "果物" ||
      fruitWords.test(item.n) ||
      (item.t.includes("果物") && /果|ゼリー|ジュレ/.test(item.n)) ||
      (item.t.includes("果物") && fruitWords.test(item.q)))
  );
}

export function keepDays(item: Item): {
  days: number | null;
  source: "data" | "text" | "guess" | null;
} {
  if (item.d !== null) return { days: item.d, source: "data" };
  if (/当日/.test(item.dr)) return { days: 0, source: "text" };
  // 月の範囲・単独の月・月初旬などは日数に数えない。
  const text = item.dr
    .normalize("NFKC")
    .replace(/(?:\d+\s*[~〜～−-]\s*)?\d+\s*月(?:頃|初旬|中旬|下旬)?/g, "");
  const numbers = text.match(/\d+/g)?.map(Number);
  if (numbers?.length) return { days: Math.min(...numbers), source: "text" };
  if (
    ["酒", "茶", "コーヒー"].includes(item.g) ||
    /缶|煎餅|せんべい|おかき|あられ|羊羹|最中|もなか|ちんすこう|かりんとう|クッキー|サブレ|佃煮|つくだ煮|ふりかけ|シロップ/.test(
      item.n,
    )
  )
    return { days: 30, source: "guess" };
  if (
    /生|大福|わらび餅|団子|だんご/.test(item.n) ||
    /要冷蔵/.test(item.st + item.sr)
  )
    return { days: 3, source: "guess" };
  return { days: null, source: null };
}
