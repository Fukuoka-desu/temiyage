import { afterEach, describe, it } from "node:test";
import { expect, vi } from "./assert.mjs";
import { defaults } from "../.test-build/score.js";
import { readConditions, writeConditions } from "../.test-build/url.js";
const read = (search) => {
  vi.stubGlobal("location", { search, pathname: "/gift/", hash: "" });
  return readConditions(["東京", "大阪", "京都"], ["和菓子", "酒"]);
};
afterEach(() => vi.unstubAllGlobals());
describe("共有条件", () => {
  it("土地なしの旧URLは未指定、明示された土地はそのまま復元する", () => {
    expect(read("").mine).toBe("");
    expect(read("?mine=大阪").mine).toBe("大阪");
    expect(read("?mine=東京").mine).toBe("東京");
    expect(read("?mine=不明").mine).toBe("");
  });
  it("不正値を既定に戻す", () => {
    expect(
      read(
        "?pref=不明&mine=不明&home=x&likes=invalid&budget=b0&use=x&sort=x&genre=x&keep=bad",
      ),
    ).toEqual(defaults);
  });
  it("空の好みと指定しない土地を保持する", () => {
    const c = read("?likes=&mine=&fpref=京都&nosweet=1&keep=1");
    expect(c.likes).toEqual([]);
    expect(c.mine).toBe("");
    expect(c.fpref).toBe("京都");
    expect(c.nosweet && c.keep).toBe(true);
  });
  it("すべての条件をURLへ保存して復元する", () => {
    const c = {
      pref: "京都",
      mine: "",
      home: "nostalgic",
      likes: ["日本茶", "家族向け"],
      traits: ["tea", "single"],
      rel: "casual",
      nosweet: true,
      keep: true,
      budget: "b3",
      use: "office",
      season: "chugen",
      sort: "days",
      fpref: "大阪",
      genre: "和菓子",
      q: "あいう ＡＢＣ",
    };
    read("");
    const replaceState = vi.fn();
    vi.stubGlobal("history", { replaceState });
    writeConditions(c);
    const url = replaceState.mock.calls[0][2];
    expect(read(new URL(url, "https://example.com").search)).toEqual(c);
  });
  it("人柄の不正値を捨て、重複を除く", () => {
    const c = read("?traits=tea,bad,office,tea,single&rel=bad");
    expect(c.traits).toEqual(["tea", "single"]);
    expect(c.rel).toBe("");
  });
  it("既定の条件はクエリを省略する", () => {
    read("");
    const replaceState = vi.fn();
    vi.stubGlobal("history", { replaceState });
    writeConditions(defaults);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/gift/");
  });
});

it("旧用途とすべての時期・用途を復元する", () => {
  expect(read("?use=first").use).toBe("visit");
  for (const use of [
    "thanks",
    "apology",
    "visit",
    "celebrate",
    "mimai",
    "souvenir",
    "office",
  ])
    expect(read(`?use=${use}`).use).toBe(use);
  for (const season of ["none", "chugen", "oseibo", "onenga"])
    expect(read(`?season=${season}`).season).toBe(season);
  expect(read("?season=bad").season).toBe("none");
});
