import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BudgetRange as RangeEvent } from "../.test-build/BudgetEvent.js";
import {
  BudgetRange,
  budgetPosition,
  budgetGrab,
  budgetThumb,
} from "../.test-build/BudgetRange.js";
import {
  defaults,
  budgets,
  budgetSteps,
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
  assert.deepEqual(budgetRange(read("?bmin=1400&bmax=5100")), [1400, 5100]);
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
  assert.ok(html.includes("価格不明も含める"));
  const any = renderToStaticMarkup(
    createElement(BudgetRange, {
      conditions: { ...defaults, budget: "any" },
      onChange: () => {},
    }),
  );
  assert.ok(!any.includes('type="checkbox"'));
  assert.ok(any.includes('aria-pressed="true"'));
});
it("予算表示は下限0・上限なし・通常範囲・指定なしを書き分ける", () => {
  for (const [conditions, expected] of [
    [rangeConditions(defaults, 0, 3000), "〜¥3,000"],
    [rangeConditions(defaults, 10000, Infinity), "¥10,000〜"],
    [rangeConditions(defaults, 1500, 5000), "¥1,500–¥5,000"],
    [{ ...defaults, budget: "any" }, "指定しない"],
  ]) {
    const html = renderToStaticMarkup(
      createElement(BudgetRange, { conditions, onChange: () => {} }),
    );
    assert.ok(html.includes(`<output>予算 ${expected}</output>`));
  }
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
  assert.deepEqual(budgetRange(option.conditions), [2000, 2100]);
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
  const nodes = (node) =>
    !node || typeof node !== "object"
      ? []
      : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
  const inputs = () =>
    nodes(tree()).filter((node) => node.props?.type === "range");
  const button = () => nodes(tree()).find((node) => node.type === "button");
  const checkbox = () =>
    nodes(tree()).find((node) => node.props?.type === "checkbox");
  inputs()[0].props.onChange({
    target: { value: String(budgetSteps.length - 2) },
  });
  assert.deepEqual(budgetRange(c), [5000, 5000]);
  inputs()[1].props.onChange({ target: { value: "0" } });
  assert.deepEqual(budgetRange(c), [5000, 5000]);
  inputs()[1].props.onChange({
    target: { value: String(budgetSteps.length - 1) },
  });
  assert.deepEqual(budgetRange(c), [5000, Infinity]);
  checkbox().props.onChange({
    target: { checked: true },
  });
  assert.equal(c.pu, true);
  button().props.onClick();
  assert.equal(c.budget, "any");
  assert.equal(c.bmin, undefined);
  inputs()[0].props.onChange({
    target: { value: String(budgetSteps.indexOf(3000)) },
  });
  assert.notEqual(c.budget, "any");
  assert.deepEqual(budgetRange(c), [3000, Infinity]);
  button().props.onClick();
  button().props.onClick();
  assert.deepEqual(budgetRange(c), [0, 3000]);
});

it("重なりと等距離は最初の移動方向で選び、それ以外は近いほうを選ぶ", () => {
  assert.equal(budgetThumb(5, 5, 5), null);
  assert.equal(budgetThumb(5, 5, 5, -1), 0);
  assert.equal(budgetThumb(5, 5, 5, 1), 1);
  assert.equal(budgetThumb(3, 9, 6), null);
  assert.equal(budgetThumb(3, 9, 6, -1), 0);
  assert.equal(budgetThumb(3, 9, 6, 1), 1);
  assert.equal(budgetThumb(3, 9, 4), 0);
  assert.equal(budgetThumb(3, 9, 8), 1);
});
it("位置はつまみの半径を考慮し0〜13へ収める", () => {
  assert.equal(budgetPosition(112, 100, 304, 12), 0);
  assert.equal(budgetPosition(252, 100, 304, 12), (budgetSteps.length - 1) / 2);
  assert.equal(budgetPosition(392, 100, 304, 12), budgetSteps.length - 1);
  assert.equal(budgetPosition(0, 100, 304, 12), 0);
  assert.equal(budgetPosition(500, 100, 304, 12), budgetSteps.length - 1);
});
it("クイック条件に予算は重複せず上下限の文字はアクセシブル名だけにある", () => {
  const source = readFileSync(
    new URL("../src/App.tsx", import.meta.url),
    "utf8",
  );
  const quick = source.slice(
    source.indexOf('className="mobile-quick"'),
    source.indexOf('className="workspace"'),
  );
  assert.ok(!quick.includes("budget"));
  const html = renderToStaticMarkup(
    createElement(BudgetRange, {
      conditions: rangeConditions(defaults, 1500, 5000),
      onChange: () => {},
    }),
  );
  assert.ok(html.includes('aria-label="予算の上限"'));
  assert.ok(!html.replace(/<[^>]*>/g, "").includes("下限"));
  assert.ok(!html.replace(/<[^>]*>/g, "").includes("上限"));
  assert.ok(html.includes("¥1,500–¥5,000"));
});

it("PC・スマホの掴み範囲は境界まで跳ばず、外側のレールは跳ぶ", () => {
  for (const [radius, reach] of [
    [12, 20],
    [14, 24],
  ]) {
    const width = 400,
      left = 100,
      lower = 3,
      upper = budgetSteps.length - 2;
    const center =
      left + radius + (lower / (budgetSteps.length - 1)) * (width - 2 * radius);
    for (const offset of [-reach, -10, 0, 10, reach]) {
      const grab = budgetGrab(
        lower,
        upper,
        center + offset,
        left,
        width,
        radius,
        reach,
      );
      assert.equal(grab.thumb, 0);
      assert.equal(grab.jump, false);
      assert.equal(grab.offset, offset);
      assert.ok(
        Math.abs(
          budgetPosition(center + offset - grab.offset, left, width, radius) -
            lower,
        ) < 1e-9,
      );
    }
    assert.equal(
      budgetGrab(lower, upper, center + reach + 1, left, width, radius, reach)
        .jump,
      true,
    );
    assert.equal(budgetPosition(left + radius, left, width, radius), 0);
    assert.equal(
      budgetPosition(left + width - radius, left, width, radius),
      budgetSteps.length - 1,
    );
  }
});
it("重なった掴み範囲は距離に関係なく方向で決め、各中心からのずれを保つ", () => {
  for (const upper of [5, 6]) {
    const x = 12 + 5.2 / (budgetSteps.length - 1) * 260;
    const args = [5, upper, x, 0, 284, 12, 24];
    assert.equal(budgetGrab(...args).thumb, null);
    for (const [direction, thumb] of [
      [-1, 0],
      [1, 1],
    ]) {
      const grab = budgetGrab(...args, direction);
      assert.equal(grab.thumb, thumb);
      assert.equal(grab.jump, false);
      const step = thumb === 0 ? 5 : upper;
      const center = 12 + (step / (budgetSteps.length - 1)) * 260;
      assert.equal(grab.offset, x - center);
    }
  }
});
