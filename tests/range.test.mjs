import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BudgetRange as RangeEvent } from "../.test-build/BudgetEvent.js";
import { BudgetRange } from "../.test-build/BudgetRange.js";
import {
  defaults,
  budgets,
  budgetRange,
  budgetText,
  rangeConditions,
  scoreItems,
  filterSort,
  relaxationOptions,
} from "../.test-build/score.js";
import { readConditions, writeConditions } from "../.test-build/url.js";
const items = JSON.parse(
  readFileSync(new URL("../src/data/items.json", import.meta.url)),
);
const read = (search) => {
  globalThis.location = { pathname: "/", search, hash: "" };
  return readConditions([], []);
};
it("範囲と予算帯の件数・並び・理由が完全一致する", () => {
  for (const [budget, [lo, hi]] of Object.entries(budgets).filter(
    ([key]) => key !== "any",
  )) {
    const c = { ...defaults, budget };
    const custom = { ...defaults, bmin: lo, bmax: hi };
    assert.deepEqual(
      filterSort(scoreItems(items, c), c),
      filterSort(scoreItems(items, custom), custom),
    );
    assert.deepEqual(rangeConditions(defaults, lo, hi), c);
  }
});
it("範囲URLを往復し予算帯を従来URLへ正規化する", () => {
  for (const query of [
    "?bmin=1500&bmax=5000",
    "?bmin=0",
    "?bmin=5000&bmax=max",
    "?bmin=2000&bmax=2000&pu=1",
    "?budget=b2",
    "?budget=any&pu=1",
    "",
  ]) {
    const c = read(query);
    let written;
    globalThis.history = {
      replaceState: (_a, _b, value) => {
        written = value;
      },
    };
    writeConditions(c);
    assert.deepEqual(read(new URL(written, "https://example.com").search), c);
  }
  const c = read("?bmin=3000&bmax=5000");
  assert.equal(c.budget, "b2");
  let written;
  globalThis.history = {
    replaceState: (_a, _b, value) => {
      written = value;
    },
  };
  writeConditions(c);
  assert.equal(written, "/?budget=b2");
});
it("不正範囲は既定、段階間は最寄りへ丸める", () => {
  for (const query of [
    "?bmin=no",
    "?bmin=-1",
    "?bmin=5000&bmax=1000",
    "?bmax=Infinity",
    "?bmin=",
    "?bmax=",
    "?bmin=Infinity",
    "?budget=b3&bmin=bad",
  ])
    assert.deepEqual(read(query), defaults);
  assert.deepEqual(budgetRange(read("?bmin=1400&bmax=5100")), [1500, 5000]);
  assert.equal(read("?budget=any&bmin=bad").budget, "any");
});
it("範囲ラベル・2つのつまみ・不明価格切替が表示される", () => {
  const c = rangeConditions(defaults, 1500, 5000);
  assert.equal(budgetText(c), "1,500円〜5,000円");
  assert.equal(
    budgetText(rangeConditions(c, 3000, Infinity)),
    "3,000円〜上限なし",
  );
  const html = renderToStaticMarkup(
    createElement(BudgetRange, { conditions: c, onChange: () => {} }),
  );
  assert.equal((html.match(/type="range"/g) || []).length, 2);
  assert.ok(html.includes('aria-label="予算の下限"'));
  assert.ok(html.includes("aria-valuetext="));
  assert.ok(html.includes('aria-pressed="false"'));
  assert.ok(html.includes("価格不明の品も含める"));
  const any = renderToStaticMarkup(
    createElement(BudgetRange, {
      conditions: { ...defaults, budget: "any" },
      onChange: () => {},
    }),
  );
  assert.ok(!any.includes('type="checkbox"'));
  assert.ok(any.includes('aria-pressed="true"'));
});
it("範囲の0件提案は上限を次の段階へ広げる", () => {
  const c = {
    ...rangeConditions(defaults, 2000, 2000),
    likes: [],
    home: "nostalgic",
  };
  const suggestions = relaxationOptions(items, c);
  const option = suggestions.find((o) => o.label === "予算を一段上げる");
  assert.ok(option);
  assert.deepEqual(budgetRange(option.conditions), [2000, 2500]);
});

it("両つまみは交差せず、操作でany解除・不明価格・指定しないが同期する", () => {
  let c = rangeConditions(defaults, 1500, 5000);
  const tree = () =>
    RangeEvent({
      conditions: c,
      onChange: (next) => {
        c = next;
      },
    });
  const inputs = () =>
    tree().props.children[2].props.children.map(
      (label) => label.props.children[1],
    );
  inputs()[0].props.onChange({ target: { value: "12" } });
  assert.deepEqual(budgetRange(c), [5000, 5000]);
  inputs()[1].props.onChange({ target: { value: "0" } });
  assert.deepEqual(budgetRange(c), [5000, 5000]);
  inputs()[1].props.onChange({ target: { value: "13" } });
  assert.deepEqual(budgetRange(c), [5000, Infinity]);
  tree().props.children[5].props.children[0].props.onChange({
    target: { checked: true },
  });
  assert.equal(c.pu, true);
  tree().props.children[1].props.children[1].props.onClick();
  assert.equal(c.budget, "any");
  assert.equal(c.bmin, undefined);
  inputs()[0].props.onChange({ target: { value: "5" } });
  assert.notEqual(c.budget, "any");
  assert.deepEqual(budgetRange(c), [3000, Infinity]);
  tree().props.children[1].props.children[1].props.onClick();
  tree().props.children[1].props.children[1].props.onClick();
  assert.deepEqual(budgetRange(c), [0, 3000]);
});
