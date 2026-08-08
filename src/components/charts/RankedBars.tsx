"use client";

import { cn } from "@/lib/utils";

export type RankedBar = { label: string; count: number; share: number };

/**
 * Ranked magnitude across nominal categories. One hue for every bar — the length
 * already encodes the value, so a darker-where-bigger ramp would double-encode it.
 * Every bar is direct-labelled, which also supplies the relief the light-mode
 * contrast warning requires.
 */
export function RankedBars({
  rows,
  emptyMessage = "Nothing recorded yet",
  unit,
  className,
}: {
  rows: RankedBar[];
  emptyMessage?: string;
  unit?: string;
  className?: string;
}) {
  if (rows.length === 0) {
    return <p className={cn("py-6 text-center text-sm text-slate-400", className)}>{emptyMessage}</p>;
  }

  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div className={cn("viz space-y-2.5", className)}>
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-300">
              {row.label}
            </span>
            <span className="shrink-0 text-slate-500 dark:text-slate-400">
              {row.count}
              {unit ? ` ${unit}` : ""} · {row.share}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full" style={{ background: "var(--viz-muted)" }}>
            <div
              className="h-2 rounded-full"
              style={{
                width: `${Math.max((row.count / max) * 100, 2)}%`,
                background: "var(--viz-series-1)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
