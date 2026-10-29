import { useId } from "react";
import type { CSSProperties } from "react";
import {
  budgetRange,
  budgetSteps,
  budgetText,
  rangeConditions,
  type Conditions,
} from "./lib/score";

export function BudgetRange({
  conditions: c,
  onChange,
}: {
  conditions: Conditions;
  onChange: (c: Conditions) => void;
}) {
  const id = useId();
  const [lo, hi] = budgetRange(c);
  const lower = budgetSteps.indexOf(lo),
    upper = budgetSteps.indexOf(hi);
  const text = budgetText(c);
  return (
    <fieldset className="budget-control">
      <legend>ご予算（税込）</legend>
      <div className="budget-heading">
        <output>{text}</output>
        <button
          type="button"
          className="chip"
          aria-pressed={c.budget === "any"}
          onClick={() => {
            if (c.budget === "any") onChange(rangeConditions(c, 0, 3000));
            else {
              const { bmin: _lo, bmax: _hi, ...rest } = c;
              onChange({ ...rest, budget: "any" });
            }
          }}
        >
          指定しない
        </button>
      </div>
      <div
        className="budget-sliders"
        style={
          {
            "--budget-lower": lower / (budgetSteps.length - 1),
            "--budget-upper": upper / (budgetSteps.length - 1),
          } as CSSProperties
        }
      >
        {(["下限", "上限"] as const).map((label, index) => (
          <label className="budget-bound" key={label}>
            <span>{label}</span>
            <input
              id={`${id}-${index}`}
              type="range"
              min={0}
              max={budgetSteps.length - 1}
              step={1}
              aria-label={`予算の${label}`}
              aria-valuetext={`${label}：${index === 0 ? lo.toLocaleString("ja-JP") + "円" : hi === Infinity ? "上限なし" : hi.toLocaleString("ja-JP") + "円"}（${text}）`}
              value={index === 0 ? lower : upper}
              list={`${id}-steps`}
              onChange={(e) => {
                const value = Number(e.target.value);
                onChange(
                  rangeConditions(
                    c,
                    budgetSteps[
                      index === 0
                        ? Math.min(value, upper, budgetSteps.length - 2)
                        : lower
                    ],
                    budgetSteps[index === 1 ? Math.max(value, lower) : upper],
                  ),
                );
              }}
            />
          </label>
        ))}
      </div>
      <datalist id={`${id}-steps`}>
        {budgetSteps.map((value, index) => (
          <option
            key={index}
            value={index}
            label={
              value === Infinity ? "∞" : value.toLocaleString("ja-JP") + "円"
            }
          />
        ))}
      </datalist>
      <div className="budget-ticks" aria-hidden="true">
        {[0, 3000, 10000, Infinity].map((value) => (
          <span
            key={value}
            style={{
              left: `calc(22px + (100% - 44px) * ${budgetSteps.indexOf(value) / (budgetSteps.length - 1)})`,
            }}
          >
            {value === Infinity ? "∞" : `${value.toLocaleString("ja-JP")}円`}
          </span>
        ))}
      </div>
      {c.budget !== "any" && (
        <label className="small-note">
          <input
            type="checkbox"
            checked={c.pu}
            onChange={(e) => onChange({ ...c, pu: e.target.checked })}
          />
          価格不明の品も含める
        </label>
      )}
    </fieldset>
  );
}
