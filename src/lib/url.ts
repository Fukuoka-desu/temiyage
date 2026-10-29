import { isTrait } from "./marks";
import {
  defaults,
  budgetSteps,
  rangeConditions,
  likeTags,
  sweetLikes,
  seasons,
  uses,
  type Conditions,
} from "./score";
export function readConditions(prefs: string[], genres: string[]): Conditions {
  const p = new URLSearchParams(location.search);
  const c: Conditions = { ...defaults, likes: [...defaults.likes], traits: [] };
  for (const key of ["pref", "mine", "fpref"] as const) {
    const v = p.get(key);
    if (v !== null && (prefs.includes(v) || (key !== "pref" && v === "")))
      c[key] = v;
  }
  for (const [key, values] of Object.entries({
    home: ["avoid", "nostalgic"],
    rel: ["", "business", "casual"],
    budget: ["b1", "b2", "b3", "b4", "any"],
    use: Object.keys(uses),
    season: Object.keys(seasons),
    sort: ["recommend", "low", "high", "days"],
    genre: ["", ...genres],
  })) {
    const v = p.get(key);
    if (v !== null && values.includes(v)) Object.assign(c, { [key]: v });
  }
  if (p.get("use") === "first") c.use = "visit";
  for (const key of ["nosweet", "keep", "pu"] as const)
    c[key] = p.get(key) === "1";
  if (p.has("likes")) {
    const values = p.get("likes")!.split(",").filter(Boolean);
    if (values.every((v) => Object.hasOwnProperty.call(likeTags, v)))
      c.likes = [...new Set(values)];
  }
  c.traits = [...new Set((p.get("traits") ?? "").split(",").filter(isTrait))];
  if (c.nosweet) c.likes = c.likes.filter((like) => !sweetLikes.includes(like));
  c.q = (p.get("q") ?? "").trim();
  if (c.budget !== "any" && (p.has("bmin") || p.has("bmax"))) {
    const rawLo = p.get("bmin") ?? "0";
    const rawHi = p.get("bmax") ?? "max";
    const lo = Number(rawLo),
      hi = rawHi === "max" ? Infinity : Number(rawHi);
    const valid =
      /^\d+$/.test(rawLo) &&
      (rawHi === "max" || /^\d+$/.test(rawHi)) &&
      Number.isFinite(lo) &&
      (Number.isFinite(hi) || rawHi === "max") &&
      lo <= hi &&
      lo <= 30000 &&
      hi >= 0;
    if (!valid) {
      c.budget = "b1";
      return c;
    }
    const nearest = (n: number) =>
      n === Infinity
        ? Infinity
        : budgetSteps
            .slice(0, -1)
            .reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
    return rangeConditions(c, nearest(lo), nearest(hi));
  }
  return c;
}
export function writeConditions(c: Conditions) {
  if (c.budget !== "any" && c.bmin !== undefined)
    c = rangeConditions(c, c.bmin, c.bmax ?? Infinity);
  const p = new URLSearchParams();
  for (const key of Object.keys(c) as (keyof Conditions)[]) {
    if (
      key === "bmin" ||
      key === "bmax" ||
      (key === "budget" && c.bmin !== undefined)
    )
      continue;
    const value = c[key];
    if (JSON.stringify(value) === JSON.stringify(defaults[key])) continue;
    p.set(
      key,
      Array.isArray(value)
        ? value.join(",")
        : typeof value === "boolean"
          ? value
            ? "1"
            : "0"
          : String(value),
    );
  }
  if (c.budget !== "any" && c.bmin !== undefined) {
    p.set("bmin", String(c.bmin));
    if (c.bmax !== undefined) p.set("bmax", String(c.bmax));
  }
  const query = p.toString();
  history.replaceState(
    null,
    "",
    `${location.pathname}${query ? "?" + query : ""}${location.hash}`,
  );
}
