import { makerNames } from "./makerNames";
import type { Item } from "./score";
import { drinkKind, type DrinkKind } from "./drinkKind";

const fold = (s: string) =>
  s
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/焼き/g, "焼");
const separators = /[\p{P}\p{S}\sー〜～]+/u;
export const normalize = (s: string) => fold(s).split(separators).join("");
export const searchWords = (q: string) =>
  q.normalize("NFKC").split(/\s+/).map(normalize).filter(Boolean);

type Field = "n" | "m" | "p" | "r" | "g" | "t" | "q";
type Alias = {
  words: string[];
  field: Field;
  values: string[];
  sake?: boolean;
  kinds?: DrinkKind[];
};
// 地名は県だけ、ジャンルはジャンルだけへ広げ、無関係な部分一致を防ぐ。
const cities: Record<string, string> = {
  博多: "福岡",
  天神: "福岡",
  小倉: "福岡",
  札幌: "北海道",
  函館: "北海道",
  小樽: "北海道",
  旭川: "北海道",
  仙台: "宮城",
  盛岡: "岩手",
  横浜: "神奈川",
  横濱: "神奈川",
  鎌倉: "神奈川",
  箱根: "神奈川",
  名古屋: "愛知",
  金沢: "石川",
  神戸: "兵庫",
  伊勢: "三重",
  宇治: "京都",
  浅草: "東京",
  銀座: "東京",
  松本: "長野",
  軽井沢: "長野",
  熱海: "静岡",
  浜松: "静岡",
  倉敷: "岡山",
  尾道: "広島",
  松山: "愛媛",
  高松: "香川",
  別府: "大分",
  湯布院: "大分",
  那覇: "沖縄",
  飛騨: "岐阜",
};
const aliases: Alias[] = [
  ...Object.entries(cities).map(([word, value]) => ({
    words: [word],
    field: "p" as const,
    values: [value],
  })),
  { words: ["九州"], field: "r", values: ["九州・沖縄"] },
  { words: ["関西", "近畿"], field: "r", values: ["近畿"] },
  { words: ["関東"], field: "r", values: ["関東"] },
  { words: ["中部"], field: "r", values: ["中部"] },
  {
    words: ["東北"],
    field: "p",
    values: ["青森", "岩手", "宮城", "秋田", "山形", "福島"],
  },
  { words: ["四国"], field: "p", values: ["徳島", "香川", "愛媛", "高知"] },
  {
    words: ["中国"],
    field: "p",
    values: ["鳥取", "島根", "岡山", "広島", "山口"],
  },
  { words: ["北陸"], field: "p", values: ["富山", "石川", "福井", "新潟"] },
  { words: ["お酒", "酒"], field: "g", values: ["酒"] },
  {
    words: ["お酒", "酒"],
    field: "n",
    values: ["日本酒", "焼酎", "ワイン", "梅酒", "ビール"],
  },
  {
    words: ["日本酒", "地酒", "清酒", "にほんしゅ"],
    field: "g",
    values: [],
    kinds: ["日本酒"],
    sake: true,
  },
  {
    words: ["焼酎", "しょうちゅう"],
    field: "g",
    values: [],
    kinds: ["焼酎", "泡盛"],
  },
  { words: ["泡盛", "あわもり"], field: "g", values: [], kinds: ["泡盛"] },
  { words: ["ワイン", "わいん"], field: "g", values: [], kinds: ["ワイン"] },
  { words: ["梅酒", "うめしゅ"], field: "g", values: [], kinds: ["梅酒"] },
  {
    words: ["ビール", "クラフトビール"],
    field: "g",
    values: [],
    kinds: ["ビール"],
  },
  {
    words: ["リキュール", "果実酒"],
    field: "g",
    values: [],
    kinds: ["リキュール"],
  },
  {
    words: ["スイーツ", "お菓子", "甘いもの"],
    field: "g",
    values: ["和菓子", "洋菓子", "チョコ"],
  },
  { words: ["和菓子"], field: "g", values: ["和菓子"] },
  { words: ["洋菓子"], field: "g", values: ["洋菓子"] },
  { words: ["チョコ", "ショコラ"], field: "g", values: ["チョコ"] },
  { words: ["チョコ"], field: "n", values: ["ショコラ"] },
  { words: ["お茶", "日本茶"], field: "g", values: ["茶"] },
  { words: ["コーヒー"], field: "n", values: ["珈琲"] },
  { words: ["おつまみ", "珍味"], field: "g", values: ["おつまみ"] },
  { words: ["ご飯のお供"], field: "g", values: ["ご飯のお供"] },
  ...[
    ["ようかん", "羊羹"],
    ["まんじゅう", "まんじゅ", "饅頭"],
    ["もなか", "最中"],
    ["せんべい", "煎餅"],
    ["めんたいこ", "明太子", "めんたい", "明太"],
    ["わらびもち", "わらび餅"],
    ["どら", "どらやき", "どら焼", "銅鑼"],
    ["ばうむくーへん", "ばーむくーへん", "ばうむ", "ばーむ"],
    ["いちご", "苺"],
    ["くり", "栗"],
    ["まっちゃ", "抹茶"],
  ].map((words) => ({ words, field: "n" as const, values: words })),
];
const preparedAliases = aliases.map((a) => ({
  ...a,
  keys: a.words.map(normalize),
  values: a.values.map(normalize),
}));
const weights: Record<Field, number> = {
  n: 100,
  m: 65,
  p: 35,
  r: 35,
  g: 35,
  t: 35,
  q: 10,
};
function matchScore(value: string, word: string, field: Field) {
  const normalized = normalize(value);
  if (!normalized.includes(word)) return 0;
  // 略語「どら」は「ドライ…」だけの位置には一致させない。
  if (field === "n" && word === "どら" && !/どら(?!い)/.test(normalized))
    return 0;
  const prefix =
    (field === "n" || field === "m") &&
    fold(value)
      .split(separators)
      .some((_, index, parts) =>
        normalize(parts.slice(index).join("")).startsWith(word),
      );
  return weights[field] + (prefix ? 15 : 0);
}
const preparedMakerNames = Object.fromEntries(
  Object.entries(makerNames).map(([maker, names]) => [
    maker,
    [...names.yomi, ...names.en].map(normalize),
  ]),
);
function makerNameScore(maker: string, word: string) {
  if (word.length < 2) return 0;
  // 品名・ジャンル・地名の言い換えは、店名の読みの途中に一致させない。
  const prefixOnly = preparedAliases.some((alias) =>
    alias.keys.some((key) => word.startsWith(key)),
  );
  let best = 0;
  for (const value of preparedMakerNames[maker] ?? []) {
    const prefix = value.startsWith(word);
    if (prefix || (!prefixOnly && word.length >= 3 && value.includes(word)))
      best = Math.max(best, (weights.m + (prefix ? 15 : 0)) * 0.9);
  }
  return best;
}
const isSake = (item: Item) => drinkKind(item) === "日本酒";

/** 全語が一致した場合だけ、語ごとの最良点の合計を返す。 */
export function searchScore(item: Item, words: string[]): number | null {
  let total = 0;
  for (const word of words) {
    let best = makerNameScore(item.m, word);
    for (const field of Object.keys(weights) as Field[]) {
      // 地方は言い換え経由だけで照合し、「北海道・東北」の混同を防ぐ。
      if (field === "r") continue;
      // 日本酒だけは、直接一致にも酒の種類の制約を適用する。
      if (word.startsWith(normalize("日本酒")) && !isSake(item)) continue;
      for (const value of field === "t" ? item.t : [item[field]])
        best = Math.max(best, matchScore(value, word, field));
    }
    for (const alias of preparedAliases) {
      if (alias.sake && !isSake(item)) continue;
      for (const key of alias.keys) {
        if (!word.startsWith(key)) continue;
        const suffix = word.slice(key.length);
        const kind = drinkKind(item);
        if (!suffix && kind && alias.kinds?.includes(kind))
          best = Math.max(best, weights.g * 0.9);
        for (const value of alias.values) {
          for (const text of alias.field === "t" ? item.t : [item[alias.field]])
            best = Math.max(
              best,
              matchScore(text, value + suffix, alias.field) * 0.9,
            );
        }
      }
    }
    if (!best) return null;
    total += best;
  }
  return total;
}

function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++)
      next.push(
        Math.min(next[j] + 1, row[j + 1] + 1, row[j] + Number(a[i] !== b[j])),
      );
    row = next;
  }
  return row[b.length];
}
export function searchSuggestions(items: Item[], q: string): string[] {
  const words = searchWords(q);
  if (!words.length) return [];
  if (items.some((item) => searchScore(item, words) !== null)) return [];
  const candidates = [
    ...items.flatMap((i) => [
      { label: i.n, value: i.n },
      { label: i.m, value: i.m },
      ...(preparedMakerNames[i.m] ?? []).map((value) => ({
        label: i.m,
        value,
      })),
    ]),
    ...aliases.flatMap((a) =>
      a.words.map((value) => ({ label: value, value })),
    ),
  ];
  const seen = new Set<string>();
  return candidates
    .flatMap(({ label, value: text }) => {
      const value = normalize(text);
      if (!value || seen.has(value) || words.includes(value)) return [];
      seen.add(value);
      const rank = Math.min(
        ...words.map((word) => {
          const limit = word.length <= 4 ? 1 : 2;
          if (Math.abs(value.length - word.length) <= limit) {
            const d = distance(value, word);
            if (d <= limit) return d;
          }
          return word.length >= 2 && value.includes(word) ? 3 : Infinity;
        }),
      );
      return Number.isFinite(rank) ? [{ label, rank }] : [];
    })
    .sort((a, b) => a.rank - b.rank || a.label.length - b.label.length)
    .filter(
      (candidate, index, all) =>
        all.findIndex((other) => other.label === candidate.label) === index,
    )
    .slice(0, 5)
    .map((candidate) => candidate.label);
}
