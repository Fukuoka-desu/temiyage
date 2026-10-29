import type { Item } from "./score";

export type DrinkKind =
  "日本酒" | "焼酎" | "泡盛" | "ワイン" | "梅酒" | "ビール" | "リキュール";

const nameRules: [RegExp, DrinkKind][] = [
  [/梅酒/, "梅酒"],
  [/ワイン/, "ワイン"],
  [/ビール|IPA/i, "ビール"],
  [/リキュール|あらごし|ゆず酒|果実酒/, "リキュール"],
  [/焼酎/, "焼酎"],
  [/泡盛/, "泡盛"],
  [/純米|吟醸|本醸造|日本酒|清酒/, "日本酒"],
];

// 店名から種類を当てている。元のデータは変えない。
const makers: Record<string, DrinkKind> = {
  霧島酒造: "焼酎",
  忠孝酒造: "泡盛",
  桃川: "日本酒",
  一ノ蔵: "日本酒",
  天寿酒造: "日本酒",
  木村酒造: "日本酒",
  小嶋総本店: "日本酒",
  大七酒造: "日本酒",
  明利酒類: "日本酒",
  第一酒造: "日本酒",
  牧野酒造: "日本酒",
  松岡醸造: "日本酒",
  飯沼本家: "日本酒",
  朝日酒造: "日本酒",
  立山酒造: "日本酒",
  若鶴酒造: "日本酒",
  福光屋: "日本酒",
  山梨銘醸: "日本酒",
  宮坂醸造: "日本酒",
  天領酒造: "日本酒",
  花の舞酒造: "日本酒",
  神戸酒心館: "日本酒",
  白鷹: "日本酒",
  梅乃宿酒造: "日本酒",
  千代むすび酒造: "日本酒",
  簸上清酒: "日本酒",
  李白酒造: "日本酒",
  宮下酒造: "日本酒",
  賀茂鶴酒造: "日本酒",
  獺祭: "日本酒",
  本家松浦酒造: "日本酒",
  梅錦山川: "日本酒",
  土佐鶴酒造: "日本酒",
  天山酒造: "日本酒",
};

export function drinkKind(item: Item): DrinkKind | null {
  if (item.g !== "酒") return null;
  for (const [rule, kind] of nameRules) if (rule.test(item.n)) return kind;
  return Object.prototype.hasOwnProperty.call(makers, item.m)
    ? makers[item.m]
    : null;
}
