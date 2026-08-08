"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type ColumnPoint = { label: string; value: number; caption?: string };

/**
 * Single-series magnitude over an ordered axis (days, hours). One hue — the
 * series identity is in the title, so no legend and no value on every column;
 * the peak is direct-labelled and the rest live in the hover tooltip.
 */
export function ColumnChart({
  points,
  height = 160,
  valueLabel,
  emptyMessage = "No activity recorded yet",
  className,
}: {
  points: ColumnPoint[];
  height?: number;
  valueLabel: string;
  emptyMessage?: string;
  className?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const max = Math.max(...points.map((p) => p.value), 1);
  const total = points.reduce((sum, p) => sum + p.value, 0);
  const peakIndex = points.reduce((best, p, i) => (p.value > points[best].value ? i : best), 0);

  if (points.length === 0 || total === 0) {
    return (
      <div
        className={cn("flex items-center justify-center text-sm text-slate-400", className)}
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("viz relative", className)}>
      <div className="flex items-end gap-[2px]" style={{ height }}>
        {points.map((point, i) => {
          const ratio = point.value / max;
          const isPeak = i === peakIndex && point.value > 0;
          return (
            <div
              key={point.label}
              className="group relative flex min-w-0 flex-1 flex-col justify-end"
              style={{ height }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Full-height hit target so short columns stay easy to hover. */}
              <div
                className="w-full rounded-t transition-colors"
                style={{
                  height: `${Math.max(ratio * 100, point.value > 0 ? 2 : 0)}%`,
                  maxWidth: 24,
                  margin: "0 auto",
                  background: isPeak || hovered === i ? "var(--viz-seq-600)" : "var(--viz-series-1)",
                }}
              />
              {hovered === i && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {point.value} {valueLabel}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">{point.caption ?? point.label}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between text-xs text-slate-400">
        <span>{points[0].caption ?? points[0].label}</span>
        <span className="text-slate-500 dark:text-slate-400">
          peak {points[peakIndex].value} · {points[peakIndex].caption ?? points[peakIndex].label}
        </span>
        <span>{points[points.length - 1].caption ?? points[points.length - 1].label}</span>
      </div>
    </div>
  );
}
