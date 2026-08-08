"use client";

import { cn } from "@/lib/utils";

export type ShareSegment = { label: string; count: number; share: number };

// Fixed slot order — a segment keeps its hue no matter how the ranking shifts.
const SLOTS = [
  "var(--viz-series-1)",
  "var(--viz-series-2)",
  "var(--viz-series-3)",
  "var(--viz-series-4)",
];

/**
 * Part-to-whole across a handful of categories, as one horizontal stacked bar.
 * Segments are separated by a 2px gap in the surface colour rather than a stroke,
 * and a legend plus direct value labels carry identity so colour is never the
 * only channel.
 */
export function ShareBar({
  segments,
  emptyMessage = "No sessions recorded yet",
  className,
}: {
  segments: ShareSegment[];
  emptyMessage?: string;
  className?: string;
}) {
  const visible = segments.filter((s) => s.count > 0).slice(0, SLOTS.length);
  const total = visible.reduce((sum, s) => sum + s.count, 0);

  if (total === 0) {
    return <p className={cn("py-6 text-center text-sm text-slate-400", className)}>{emptyMessage}</p>;
  }

  return (
    <div className={cn("viz space-y-3", className)}>
      <div className="flex h-6 w-full overflow-hidden rounded-md">
        {visible.map((segment, i) => (
          <div
            key={segment.label}
            title={`${segment.label}: ${segment.count} (${segment.share}%)`}
            style={{
              width: `${(segment.count / total) * 100}%`,
              background: SLOTS[i],
              // The gap, not a border, is what separates touching segments.
              marginRight: i < visible.length - 1 ? 2 : 0,
            }}
          />
        ))}
      </div>

      <ul className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {visible.map((segment, i) => (
          <li key={segment.label} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: SLOTS[i] }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300">
              {segment.label}
            </span>
            <span className="shrink-0 font-medium text-slate-900 tabular-nums dark:text-slate-100">
              {segment.count}
            </span>
            <span className="w-12 shrink-0 text-right text-slate-500 tabular-nums dark:text-slate-400">
              {segment.share}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
