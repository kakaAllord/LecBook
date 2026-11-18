"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** Past this many options a search box is shown above the list. */
const SEARCH_THRESHOLD = 6;

export function CheckboxGroup({
  options,
  value,
  onChange,
  className,
  allowSelectAll = true,
  searchPlaceholder = "Search…",
}: {
  options: { id: string; label: string; hint?: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  className?: string;
  allowSelectAll?: boolean;
  searchPlaceholder?: string;
}) {
  const [query, setQuery] = useState("");
  const searchable = options.length > SEARCH_THRESHOLD;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q));
  }, [options, query]);

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  // "Select all" acts on what the search is showing, so typing "Level I" and
  // ticking it selects exactly those; anything already ticked but filtered out
  // of view is left as it was.
  const visibleIds = visible.map((o) => o.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => value.includes(id));
  const filtering = query.trim().length > 0;

  function toggleAllVisible() {
    if (allVisibleSelected) {
      onChange(value.filter((id) => !visibleIds.includes(id)));
    } else {
      onChange(Array.from(new Set([...value, ...visibleIds])));
    }
  }

  return (
    <div className={cn("rounded-md border border-slate-300 dark:border-slate-700", className)}>
      {options.length === 0 ? (
        <p className="px-3 py-2 text-sm text-slate-400">No options available</p>
      ) : (
        <>
          {searchable && (
            <div className="relative border-b border-slate-200 p-2 dark:border-slate-800">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label="Search options"
                className="w-full rounded border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          )}
          <div className="max-h-48 space-y-0.5 overflow-y-auto p-2">
            {allowSelectAll && visible.length > 0 && (
              <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                {filtering ? `Select all shown (${visible.length})` : "Select all"}
              </label>
            )}
            {visible.length === 0 && <p className="px-1 py-1 text-sm text-slate-400">No matches</p>}
            {visible.map((opt) => (
              <label
                key={opt.id}
                className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <input
                  type="checkbox"
                  checked={value.includes(opt.id)}
                  onChange={() => toggle(opt.id)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="min-w-0">
                  <span className="block">{opt.label}</span>
                  {opt.hint && <span className="block text-xs text-slate-400">{opt.hint}</span>}
                </span>
              </label>
            ))}
          </div>
          {searchable && value.length > 0 && (
            <p className="border-t border-slate-200 px-3 py-1.5 text-xs text-slate-500 dark:border-slate-800">
              {value.length} of {options.length} selected
            </p>
          )}
        </>
      )}
    </div>
  );
}
