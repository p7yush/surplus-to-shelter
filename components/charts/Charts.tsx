"use client";

import { FOOD_TYPES, FOOD_TYPE_ORDER } from "@/lib/domain/constants";
import type { ImpactTotals } from "@/lib/domain/impact";

export function DailyBars({ daily }: { daily: ImpactTotals["daily"] }) {
  const max = Math.max(1, ...daily.map((bucket) => bucket.kg));

  return (
    <div className="flex h-40 items-stretch gap-2">
      {daily.map((bucket) => {
        const height = Math.max(4, (bucket.kg / max) * 100);
        const isToday = bucket === daily[daily.length - 1];
        return (
          <div
            key={bucket.day}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
          >
            <span className="text-[0.6rem] font-mono text-muted">
              {Math.round(bucket.kg)}
            </span>
            <div className="flex min-h-0 w-full flex-1 items-end">
              <div
                className={`w-full rounded-t-md transition-all ${
                  isToday
                    ? "bg-gradient-to-t from-brand/40 to-brand"
                    : "bg-gradient-to-t from-sky-accent/20 to-sky-accent/70"
                }`}
                style={{ height: `${height}%` }}
                title={`${bucket.kg.toFixed(1)} kg · ${Math.round(bucket.meals)} meals`}
              />
            </div>
            <span className="text-[0.6rem] text-faint">
              {new Date(bucket.day).toLocaleDateString([], { weekday: "short" })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function FoodTypeSplit({
  kgByFoodType,
}: {
  kgByFoodType: ImpactTotals["kgByFoodType"];
}) {
  const total = FOOD_TYPE_ORDER.reduce(
    (sum, type) => sum + (kgByFoodType[type] ?? 0),
    0,
  );

  if (total === 0) {
    return <p className="text-xs text-faint">No deliveries logged yet.</p>;
  }

  return (
    <div className="space-y-2.5">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-white/5">
        {FOOD_TYPE_ORDER.map((type) => {
          const share = (kgByFoodType[type] ?? 0) / total;
          if (share <= 0) return null;
          return (
            <span
              key={type}
              style={{ width: `${share * 100}%`, background: FOOD_TYPES[type].accent }}
              title={`${FOOD_TYPES[type].label}: ${kgByFoodType[type].toFixed(1)} kg`}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        {FOOD_TYPE_ORDER.filter((type) => (kgByFoodType[type] ?? 0) > 0).map((type) => (
          <div key={type} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5 text-muted">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: FOOD_TYPES[type].accent }}
              />
              <span className="truncate">{FOOD_TYPES[type].shortLabel}</span>
            </span>
            <span className="font-mono text-ink">
              {Math.round((kgByFoodType[type] / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
