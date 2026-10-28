import ts from 'typescript';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
const out = new URL('../.test-build/', import.meta.url);
try {
  mkdirSync(out, { recursive: true });
  for (const file of ['score', 'url']) {
    const source = readFileSync(new URL(`../src/lib/${file}.ts`, import.meta.url), 'utf8');
    const result = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    });
    writeFileSync(new URL(`${file}.js`, out), result.outputText.replace("'./score'", "'./score.js'"));
  }
  await import('../tests/score.test.mjs');
  await import('../tests/url.test.mjs');
} finally {
  rmSync(out, { recursive: true, force: true });
}
