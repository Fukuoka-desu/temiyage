// Execute the real TypeScript modules with the existing compiler; no expected filters here.
import ts from "typescript";
import { readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
const dir = new URL("../.counts-build/", import.meta.url);
mkdirSync(dir, { recursive: true });
try {
  for (const name of ["marks", "score", "url"]) {
    let source = readFileSync(
      new URL(`../src/lib/${name}.ts`, import.meta.url),
      "utf8",
    );
    source = source.replace(
      /import data from ['"]\.\.\/data\/marks\.json['"];?/,
      `const data = ${readFileSync(new URL("../src/data/marks.json", import.meta.url), "utf8")};`,
    );
    const js = ts
      .transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ES2022,
        },
      })
      .outputText.replace(/(['"])\.\/(score|marks)\1/g, "'./$2.js'");
    writeFileSync(new URL(`${name}.js`, dir), js);
  }
  const { defaults, scoreItems, filterSort, relaxationOptions } =
    await import("../.counts-build/score.js");
  const { readConditions, writeConditions } =
    await import("../.counts-build/url.js");
  const items = JSON.parse(
    readFileSync(new URL("../src/data/items.json", import.meta.url), "utf8"),
  );
  const cases = JSON.parse(readFileSync(0, "utf8"));
  const prefs = [...new Set(items.map((i) => i.p))],
    genres = [...new Set(items.map((i) => i.g))];
  const output = cases.map((test) => {
    const c = { ...defaults, ...test.patch };
    const selectedItems = test.boundary
      ? [3000, 5000, 10000].map((price, index) => ({
          ...items[0],
          id: 10001 + index,
          y: price,
          p: "境界テスト",
          t: [],
          ko: false,
        }))
      : items;
    const results = filterSort(scoreItems(selectedItems, c), c);
    globalThis.location = { pathname: "/", hash: "", search: test.url || "" };
    globalThis.history = {
      replaceState: (_a, _b, url) => {
        location.search = new URL(url, "https://example.com").search;
      },
    };
    if (!test.url) writeConditions(c);
    const restored = readConditions(prefs, genres);
    const round = filterSort(scoreItems(selectedItems, restored), restored);
    const baseline = filterSort(
      scoreItems(items, { ...c, season: "none", use: "thanks" }),
      c,
    );
    return {
      count: results.length,
      ids: results.map((r) => r.item.id),
      first: results[0]?.item.id ?? null,
      cautionIds: results
        .filter((r) => r.cautions.length)
        .map((r) => r.item.id),
      cautionTotal: results.reduce((n, r) => n + r.cautions.length, 0),
      baselineIds: baseline.map((r) => r.item.id),
      roundCount: round.length,
      restored,
      relax: relaxationOptions(items, c).map((r) => ({
        label: r.label,
        count: r.count,
      })),
    };
  });
  process.stdout.write(JSON.stringify(output));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
