import { itemMarks, traitReason, type Marks, type Trait } from "./marks";

export interface Item {
  id: number;
  r: string;
  p: string;
  n: string;
  q: string;
  m: string;
  y: number | null;
  d: number | null;
  dr: string;
  st: string;
  sr: string;
  ko: boolean;
  g: string;
  t: string[];
  u: string;
  src: string;
  c: string;
  v: boolean;
  vr: string;
}
export const likeTags: Record<string, string[]> = {
  甘いもの: ["和菓子", "洋菓子", "チョコ"],
  和菓子: ["和菓子"],
  洋菓子: ["洋菓子"],
  チョコレート: ["チョコ"],
  お酒: ["お酒"],
  "コーヒー・紅茶": ["コーヒー・紅茶"],
  日本茶: ["日本茶"],
  "辛党・おつまみ": ["おつまみ"],
  ご飯のお供: ["ご飯のお供"],
  ヘルシー: ["ヘルシー"],
  果物: ["果物"],
  家族向け: ["個包装"],
};
export const budgets = {
  b1: [0, 3000],
  b2: [3000, 5000],
  b3: [5000, 10000],
  b4: [10000, Infinity],
} as const;
export const seasons = {
  none: "季節を問わない",
  chugen: "お中元（夏）",
  oseibo: "お歳暮（冬）",
  onenga: "お年賀",
};
export const uses = {
  thanks: "お礼",
  apology: "お詫び",
  visit: "ご挨拶・訪問",
  celebrate: "お祝い",
  mimai: "お見舞い",
  souvenir: "帰省・旅行のおみやげ",
  office: "職場への差し入れ",
};
export interface Conditions {
  pref: string;
  mine: string;
  home: "avoid" | "nostalgic";
  likes: string[];
  traits: Trait[];
  rel: "" | "business" | "casual";
  nosweet: boolean;
  keep: boolean;
  budget: keyof typeof budgets;
  season: keyof typeof seasons;
  use: keyof typeof uses;
  sort: "recommend" | "low" | "high" | "days";
  fpref: string;
  genre: string;
  q: string;
}
export const defaults: Conditions = {
  pref: "東京",
  mine: "",
  home: "avoid",
  likes: ["甘いもの"],
  traits: [],
  rel: "",
  nosweet: false,
  keep: false,
  budget: "b1",
  season: "none",
  use: "visit",
  sort: "recommend",
  fpref: "",
  genre: "",
  q: "",
};
export interface Result {
  item: Item;
  score: number;
  why: string[];
  cautions: string[];
}
export function scoreItems(
  items: Item[],
  c: Conditions,
  marks: Marks = itemMarks,
): Result[] {
  const results: Result[] = [];
  const [lo, hi] = budgets[c.budget];
  const mine = c.mine || "東京";
  for (const it of items) {
    const has = (tag: string) =>
      tag === "個包装" ? it.ko : it.t.includes(tag);
    if (c.nosweet && ["和菓子", "洋菓子", "チョコ"].some(has)) continue;
    // 贈り手と相手の土地が同じでも、相手の出身地の除外を優先する。
    if (c.home === "avoid" && c.pref && it.p === c.pref) continue;
    if (c.keep && it.d !== null && it.d < 7) continue;
    if (it.y === null) continue;
    let score = 0;
    const why: string[] = [];
    const cautions: string[] = [];
    const itemMark = marks[it.id] ?? {};
    const add = (n: number, reason?: string) => {
      score += n;
      if (reason) why.push(reason);
    };
    if (it.y >= lo && it.y <= hi) add(5, "予算内");
    else if (it.y >= (lo * 80) / 100 && it.y <= (hi * 115) / 100)
      add(1, "予算に近い");
    else continue;
    let hit = 0;
    for (const key of c.likes) {
      if (likeTags[key]?.some(has)) {
        hit++;
        why.push(
          key === "家族向け" ? "個包装で分けやすい" : `${key}好きに合う`,
        );
      }
    }
    if (c.likes.length && hit === 0) continue;
    score += hit * 4;
    if (c.use === "visit") {
      if (has("個包装")) add(2, "個包装で渡しやすい");
      if (has("定番")) add(2, "定番で外さない");
    }
    if (c.use === "apology") {
      if (has("和菓子")) add(2);
      if (has("高級感")) add(3, "改まった場に合う");
      if (it.d !== null && it.d >= 30) add(1);
      if (has("お酒") || itemMark.alcohol) add(-3);
      if (has("おつまみ")) add(-1);
    }
    if (c.use === "thanks") {
      if (has("高級感")) add(2, "お礼にふさわしい格");
      if (has("定番")) add(1);
    }
    if (c.use === "office") {
      if (marks[it.id]?.office) add(4, "人数分に分けやすい（個包装・数量）");
      if (has("個包装")) add(4, "人数分に分けやすい");
      else add(-3);
      if (it.d !== null && it.d >= 14) add(1);
    }
    if (c.use === "celebrate") {
      if (has("お酒")) add(2, "お祝いの席に合う");
      if (has("高級感")) add(2);
    }
    if (c.season === "chugen") {
      if (itemMark.summer_fit) add(3, "夏の贈り物に合う");
      if (itemMark.summer_caution) {
        add(-4);
        cautions.push(
          "暑い時期は日持ち・保存方法（要冷蔵など）にご注意ください",
        );
      }
    }
    if (c.season === "oseibo" && itemMark.winter_fit)
      add(3, "冬の贈り物に合う");
    if (c.season === "onenga") {
      if (itemMark.newyear_fit) add(3, "新年のご挨拶に合う");
      if (itemMark.short_keep) add(-2);
    }
    if (c.use === "apology") {
      if (itemMark.flashy) add(-3);
      if (itemMark.classic_sweets) add(3, "お詫びにも落ち着いた定番の品");
      if (itemMark.alcohol || itemMark.flashy)
        cautions.push("お詫びには、好みの分かれる品は控えるのが無難とされます");
    }
    if (c.use === "mimai") {
      if (itemMark.alcohol) {
        add(-5);
        cautions.push("お見舞いにはお酒は控えるのが一般的とされます");
      }
      if (itemMark.short_keep)
        cautions.push("日持ちが短いので、相手の状況に合わせてお選びください");
      if (itemMark.elderly) add(2, "食べやすい");
    }
    if (c.use === "souvenir") {
      if (itemMark.easy_share) add(2, "みんなで分けやすい");
      if (it.d !== null && it.d >= 7) add(1);
      if (it.y <= 3000) add(1);
    }
    if (c.use === "office" && itemMark.short_keep) add(-2);
    if (c.keep && it.d !== null && it.d >= 30) add(2, "日持ちする");
    if (c.home === "nostalgic" && c.pref && it.p === c.pref) {
      score += 8;
      why.unshift("相手の地元の懐かしい味");
    }
    if (c.home === "avoid" && it.p === mine) {
      score += 3;
      why.unshift("こちらの土地の名物で話題になる");
    }
    const priority: string[] = [];
    for (const trait of c.traits) {
      const evidence = itemMark[trait];
      if (evidence) {
        score += 3;
        priority.push(traitReason(trait, evidence));
      }
    }
    if (c.rel) {
      if (itemMark[c.rel]) {
        score += 3;
        priority.push(
          c.rel === "business"
            ? "目上の方にも失礼のない価格帯"
            : "気軽に渡せる価格",
        );
      } else score -= c.rel === "business" ? 2 : 1;
    }
    why.unshift(...priority);
    if (it.v) score += 0.5;
    results.push({ item: it, score, why, cautions });
  }
  return results.sort(
    (a, b) =>
      Number(b.item.v) - Number(a.item.v) ||
      b.score - a.score ||
      a.item.y! - b.item.y!,
  );
}
export const normalize = (s: string) =>
  s
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
export function filterSort(results: Result[], c: Conditions) {
  return results
    .filter(
      ({ item: i }) =>
        (!c.fpref || i.p === c.fpref) &&
        (!c.genre || i.g === c.genre) &&
        normalize([i.n, i.m, i.p, i.q].join(" ")).includes(normalize(c.q)),
    )
    .sort((a, b) =>
      c.sort === "low"
        ? a.item.y! - b.item.y!
        : c.sort === "high"
          ? b.item.y! - a.item.y!
          : c.sort === "days"
            ? (b.item.d ?? -1) - (a.item.d ?? -1)
            : 0,
    );
}
