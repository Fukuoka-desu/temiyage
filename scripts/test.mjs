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
  for (const file of [
    "marks",
    "score",
    "infer",
    "search",
    "makerNames",
    "drinkKind",
    "url",
    "ItemPrice",
    "Artwork",
    "ItemImage",
    "BudgetRange",
  ]) {
    let source = readFileSync(
      new URL(
        ["ItemPrice", "Artwork", "ItemImage", "BudgetRange"].includes(file)
          ? `../src/${file}.tsx`
          : `../src/lib/${file}.ts`,
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
    if (file === "ItemImage") {
      const eventSource = source.replace(
        'import { useState } from "react";',
        "const useState = () => globalThis.__imageState();",
      );
      const eventJS = ts
        .transpileModule(eventSource, {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ES2022,
            jsx: ts.JsxEmit.ReactJSX,
          },
        })
        .outputText.replace('"./Artwork"', '"./Artwork.js"');
      writeFileSync(new URL("ImageEvent.js", out), eventJS);
    }
    if (file === "BudgetRange") {
      const eventSource = source
        .replace(
          'import { useRef } from "react";',
          "const useRef = () => ({ current: null });",
        )
        .replace(
          'import { useId } from "react";',
          'const useId = () => "budget-test";',
        );
      const eventJS = ts
        .transpileModule(eventSource, {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ES2022,
            jsx: ts.JsxEmit.ReactJSX,
          },
        })
        .outputText.replace('"./lib/score"', '"./score.js"');
      writeFileSync(new URL("BudgetEvent.js", out), eventJS);
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
      result.outputText.replace(
        /(['"])\.\/(?:lib\/)?(infer|score|search|makerNames|drinkKind|marks|Artwork)\1/g,
        "'./$2.js'",
      ),
    );
  }
  await import("../tests/score.test.mjs");
  await import("../tests/infer.test.mjs");
  await import("../tests/search.test.mjs");
  await import("../tests/url.test.mjs");
  await import("../tests/price.test.mjs");
  await import("../tests/range.test.mjs");
  await import("../tests/image.test.mjs");
  await import("../tests/filter-accessibility.test.mjs");
  await import("../tests/results-heading.test.mjs");
} finally {
  rmSync(out, { recursive: true, force: true });
}
