import { execFileSync } from "node:child_process";
import ts from "typescript";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
const out = new URL("../.test-build/", import.meta.url);
try {
  mkdirSync(out, { recursive: true });
  execFileSync(
    "python3",
    ["-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py"],
    { stdio: "inherit", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } },
  );
  for (const file of ["marks", "score", "url", "ItemPrice"]) {
    let source = readFileSync(
      new URL(
        file === "ItemPrice" ? "../src/ItemPrice.tsx" : `../src/lib/${file}.ts`,
        import.meta.url,
      ),
      "utf8",
    );
    if (file === "marks") {
      const marks = readFileSync(
        new URL("../src/data/marks.json", import.meta.url),
        "utf8",
      );
      source = source.replace(
        /import data from ['"]\.\.\/data\/marks\.json['"];?/,
        `const data = ${marks};`,
      );
    }
    const result = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    });
    writeFileSync(
      new URL(`${file}.js`, out),
      result.outputText.replace(/(['"])\.\/(score|marks)\1/g, "'./$2.js'"),
    );
  }
  await import("../tests/score.test.mjs");
  await import("../tests/url.test.mjs");
  await import("../tests/price.test.mjs");
} finally {
  rmSync(out, { recursive: true, force: true });
}
