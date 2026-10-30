import { useId } from "react";
import { useRef } from "react";
import type { CSSProperties } from "react";
import {
  budgetRange,
  budgetSteps,
  budgetText,
  rangeConditions,
  type Conditions,
} from "./lib/score";

export function budgetPosition(clientX: number, left: number, width: number) {
  return Math.max(
    0,
    Math.min(budgetSteps.length - 1, ((clientX - left - 22) / Math.max(1, width - 44)) * (budgetSteps.length - 1)),
  );
}

export function budgetThumb(
  lower: number,
  upper: number,
  position: number,
  direction = 0,
): 0 | 1 | null {
  const distance = Math.abs(position - lower) - Math.abs(position - upper);
  if (lower === upper || Math.abs(distance) < 1e-9) {
    return direction < 0 ? 0 : direction > 0 ? 1 : null;
  }
  return distance < 0 ? 0 : 1;
}

export function BudgetRange({
  conditions: c,
  onChange,
}: {
  conditions: Conditions;
  onChange: (c: Conditions) => void;
}) {
  const id = useId();
  const drag = useRef<{
    pointerId: number;
    startX: number;
    position: number;
    thumb: 0 | 1 | null;
  } | null>(null);
  const [lo, hi] = budgetRange(c);
  const lower = budgetSteps.indexOf(lo),
    upper = budgetSteps.indexOf(hi);
  const text = budgetText(c);
  const amount = (value: number) =>
    value === Infinity ? "上限なし" : `¥${value.toLocaleString("ja-JP")}`;
  const display =
    c.budget === "any"
      ? "指定しない"
      : hi === Infinity
        ? `${amount(lo)}〜`
        : lo === 0
          ? `〜${amount(hi)}`
          : `${amount(lo)}–${amount(hi)}`;
  const update = (index: number, value: number) => {
    onChange(
      rangeConditions(
        c,
        budgetSteps[index === 0 ? Math.min(value, upper, budgetSteps.length - 2) : lower],
        budgetSteps[index === 1 ? Math.max(value, lower) : upper],
      ),
    );
  };
  return (
    <fieldset className="budget-control">
      <legend className="sr-only">ご予算（税込）</legend>
      <div className="budget-heading">
        <output>予算 {display}</output>
      </div>
      <div
        className="budget-sliders"
        onPointerDown={(e) => {
          if (!e.isPrimary || e.button !== 0 || drag.current) return;
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const position = budgetPosition(e.clientX, rect.left, rect.width);
          const thumb = budgetThumb(lower, upper, position);
          drag.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            position,
            thumb,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
          if (thumb !== null) {
            e.currentTarget.querySelectorAll("input")[thumb].focus();
            update(thumb, Math.round(position));
          }
        }}
        onPointerMove={(e) => {
          const active = drag.current;
          if (!active || active.pointerId !== e.pointerId) return;
          if (active.thumb === null) {
            active.thumb = budgetThumb(
              lower,
              upper,
              active.position,
              e.clientX - active.startX,
            );
            if (active.thumb === null) return;
            e.currentTarget.querySelectorAll("input")[active.thumb].focus();
          }
          const rect = e.currentTarget.getBoundingClientRect();
          update(
            active.thumb,
            Math.round(budgetPosition(e.clientX, rect.left, rect.width)),
          );
        }}
        onPointerUp={(e) => {
          if (drag.current?.pointerId !== e.pointerId) return;
          drag.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={(e) => {
          if (drag.current?.pointerId === e.pointerId) drag.current = null;
        }}
        onLostPointerCapture={(e) => {
          if (drag.current?.pointerId === e.pointerId) drag.current = null;
        }}
        style={
          {
            "--budget-lower": lower / (budgetSteps.length - 1),
            "--budget-upper": upper / (budgetSteps.length - 1),
          } as CSSProperties
        }
      >
        {(["下限", "上限"] as const).map((label, index) => (
          <input
            key={label}
            id={`${id}-${index}`}
            type="range"
            min={0}
            max={budgetSteps.length - 1}
            step={1}
            aria-label={`予算の${label}`}
            aria-valuetext={`${label}：${index === 0 ? lo.toLocaleString("ja-JP") + "円" : hi === Infinity ? "上限なし" : hi.toLocaleString("ja-JP") + "円"}（${text}）`}
            value={index === 0 ? lower : upper}
            onChange={(e) => {
              const value = Number(e.target.value);
              update(index, value);
            }}
          />
        ))}
      </div>
      <div className="budget-actions">
        <button
          type="button"
          className="budget-any"
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
        {c.budget !== "any" && (
          <label className="budget-unknown">
            <input
              type="checkbox"
              checked={c.pu}
              onChange={(e) => onChange({ ...c, pu: e.target.checked })}
            />
            価格不明も含める
          </label>
        )}
      </div>
    </fieldset>
  );
}
