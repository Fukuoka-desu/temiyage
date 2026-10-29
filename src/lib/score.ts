import {
  taste,
  isAlcohol,
  drinkTea,
  isHealthy,
  isFruit,
  keepDays,
} from "./infer";
import { searchScore, searchWords } from "./search";
export { normalize } from "./search";
import { itemMarks, traitReason, type Marks, type Trait } from "./marks";

export interface Item {
  img?: string;
  imgsrc?: string;
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
export const sweetLikes = ["甘いもの", "和菓子", "洋菓子", "チョコレート"];
export const budgets = {
  b1: [0, 3000],
  b2: [3000, 5000],
  b3: [5000, 10000],
  b4: [10000, Infinity],
  any: [0, Infinity],
} as const;
export const budgetSteps = [
  0,
  1000,
  1500,
  2000,
  2500,
  3000,
  4000,
  5000,
  7000,
  10000,
  15000,
  20000,
  30000,
  Infinity,
];
export function budgetRange(c: Conditions): readonly [number, number] {
  return c.bmin === undefined
    ? budgets[c.budget]
    : [c.bmin, c.bmax ?? Infinity];
}
export function rangeConditions(
  c: Conditions,
  lo: number,
  hi: number,
): Conditions {
  const { bmin: _lo, bmax: _hi, ...rest } = c;
  const band = (["b1", "b2", "b3", "b4"] as const).find(
    (key) => budgets[key][0] === lo && budgets[key][1] === hi,
  );
  return band
    ? { ...rest, budget: band }
    : {
        ...rest,
        budget: "b1",
        bmin: lo,
        ...(hi === Infinity ? {} : { bmax: hi }),
      };
}
export function budgetText(c: Conditions) {
  if (c.budget === "any") return "指定しない";
  const [lo, hi] = budgetRange(c);
  return `${lo.toLocaleString("ja-JP")}円〜${hi === Infinity ? "上限なし" : hi.toLocaleString("ja-JP") + "円"}`;
}
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
  pu: boolean;
  budget: keyof typeof budgets;
  bmin?: number;
  bmax?: number;
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
  pu: false,
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
  tier: number;
  traitHits: number;
}
export function scoreItems(
  items: Item[],
  c: Conditions,
  marks: Marks = itemMarks,
): Result[] {
  const results: Result[] = [];
  const [lo, hi] = budgetRange(c);
  const mine = c.mine || "東京";
  for (const it of items) {
    const has = (tag: string) =>
      tag === "個包装" ? it.ko : it.t.includes(tag);
    const flavor = taste(it);
    const shelf = keepDays(it);
    const knownKeep = shelf.source === "data" || shelf.source === "text";
    let tier =
      (c.keep && !knownKeep) || (c.budget !== "any" && it.y === null) ? 1 : 0;
    if (c.nosweet && flavor === "sweet") continue;
    // 贈り手と相手の土地が同じでも、相手の出身地の除外を優先する。
    if (c.home === "avoid" && c.pref && it.p === c.pref) continue;
    if (c.keep && knownKeep && shelf.days !== null && shelf.days < 7) continue;
    if (it.y === null && c.budget !== "any" && !c.pu) continue;
    let score = 0;
    const why: string[] = [];
    const cautions: string[] = [];
    if (c.keep && !knownKeep)
      cautions.push("日持ちは未確認です。購入前にご確認ください");
    const itemMark = marks[it.id] ?? {};
    const add = (n: number, reason?: string) => {
      score += n;
      if (reason) why.push(reason);
    };
    if (c.budget !== "any" && it.y !== null) {
      if (it.y >= lo && it.y <= hi) add(5, "予算内");
      else if (it.y >= (lo * 80) / 100 && it.y <= (hi * 115) / 100) {
        add(1, "予算に近い（予算外）");
        tier = 2;
      } else continue;
    }
    let hit = 0;
    for (const key of c.likes) {
      const tea = drinkTea(it);
      const matches =
        key === "甘いもの"
          ? flavor === "sweet"
          : key === "和菓子" || key === "洋菓子"
            ? flavor !== "savory" && (it.g === key || has(key))
            : key === "チョコレート"
              ? flavor !== "savory" &&
                (it.g === "チョコ" ||
                  has("チョコ") ||
                  /チョコ|ショコラ|カカオ|ガナッシュ/.test(it.n))
              : key === "お酒"
                ? isAlcohol(it)
                : key === "コーヒー・紅茶"
                  ? tea.western || it.g === "コーヒー"
                  : key === "日本茶"
                    ? tea.japanese
                    : key === "辛党・おつまみ"
                      ? has("おつまみ") ||
                        (flavor === "savory" && it.g !== "ご飯のお供")
                      : key === "ヘルシー"
                        ? isHealthy(it)
                        : key === "果物"
                          ? isFruit(it)
                          : likeTags[key]?.some(has);
      if (matches) {
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
      if (it.y !== null && it.y <= 3000) add(1);
    }
    if (c.use === "office" && itemMark.short_keep) add(-2);
    if (c.keep && knownKeep && shelf.days !== null && shelf.days >= 30)
      add(2, "日持ちする");
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
    results.push({
      item: it,
      score,
      why,
      cautions,
      tier,
      traitHits: c.traits.filter((trait) => Boolean(itemMark[trait])).length,
    });
  }
  return results.sort(
    (a, b) =>
      a.tier - b.tier ||
      b.traitHits - a.traitHits ||
      Number(a.item.y === null) - Number(b.item.y === null) ||
      Number(b.item.v) - Number(a.item.v) ||
      b.score - a.score ||
      (a.item.y ?? 0) - (b.item.y ?? 0),
  );
}
export function filterSort(results: Result[], c: Conditions) {
  const words = searchWords(c.q);
  const scores = new Map<Result, number>();
  return results
    .filter((result) => {
      const i = result.item;
      if ((c.fpref && i.p !== c.fpref) || (c.genre && i.g !== c.genre))
        return false;
      const score = searchScore(i, words);
      if (score === null) return false;
      scores.set(result, score);
      return true;
    })
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        b.traitHits - a.traitHits ||
        (c.sort === "recommend" && words.length
          ? (scores.get(b) ?? 0) - (scores.get(a) ?? 0)
          : 0) ||
        Number(a.item.y === null) - Number(b.item.y === null) ||
        Number(b.item.v) - Number(a.item.v) ||
        (c.sort === "low"
          ? (a.item.y ?? 0) - (b.item.y ?? 0)
          : c.sort === "high"
            ? (b.item.y ?? 0) - (a.item.y ?? 0)
            : c.sort === "days"
              ? (keepDays(b.item).days ?? -1) - (keepDays(a.item).days ?? -1)
              : 0),
    );
}

export function relaxationOptions(items: Item[], c: Conditions) {
  const [lo, hi] = budgetRange(c);
  const options: [string, Partial<Conditions>][] = [
    ["産地の指定を解除", { fpref: "" }],
    ["検索語をクリア", { q: "" }],
    ["ジャンルを解除", { genre: "" }],
    ["相手の地元も含める（懐かしい地元の味に切替）", { home: "nostalgic" }],
    ["好みを解除", { likes: [] }],
    [
      "予算を一段上げる",
      c.budget === "any"
        ? {}
        : rangeConditions(
            c,
            lo,
            budgetSteps[
              Math.min(budgetSteps.indexOf(hi) + 1, budgetSteps.length - 1)
            ],
          ),
    ],
    ["価格不明の品も含める", { pu: true }],
    ["日持ち重視を外す", { keep: false }],
    ["甘いもの苦手を外す", { nosweet: false }],
  ];
  if (c.likes.length > 1)
    for (const like of c.likes)
      options.push([
        `好み『${like}』を外す`,
        { likes: c.likes.filter((key) => key !== like) },
      ]);
  if (c.budget !== "any")
    options.push([
      "予算を指定しない",
      { budget: "any", bmin: undefined, bmax: undefined },
    ]);
  const current = filterSort(scoreItems(items, c), c).length;
  return options
    .map(([label, patch]) => {
      const conditions = { ...c, ...patch };
      return {
        label,
        conditions,
        count: filterSort(scoreItems(items, conditions), conditions).length,
      };
    })
    .filter((option) => option.count > current)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}
