"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
  /** A second, quieter line — a code, a course list — that is searched too. */
  hint?: string;
};

/**
 * A dropdown with a search box, used wherever someone picks one course, module,
 * assessment or person out of a list. A college easily has more of each than a
 * plain dropdown is pleasant to scroll through, so typing a few letters of the
 * name (or its code) narrows the list instead.
 */
export function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  emptyOption,
  disabled,
  error,
  className,
  searchPlaceholder = "Type to search…",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Label for a leading "" choice, such as "All modules". Omit when a choice is required. */
  emptyOption?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
  searchPlaceholder?: string;
}) {
  const generatedId = useId();
  const listId = `${id ?? generatedId}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const allOptions = useMemo<SelectOption[]>(
    () => (emptyOption !== undefined ? [{ value: "", label: emptyOption }, ...options] : options),
    [emptyOption, options]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q));
  }, [allOptions, query]);

  const selected = allOptions.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  // Each opening starts from a clear search with the current choice highlighted.
  function openList() {
    setQuery("");
    const index = allOptions.findIndex((o) => o.value === value);
    setActive(index >= 0 ? index : 0);
    setOpen(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(option: SelectOption) {
    onChange(option.value);
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      // Closes the list without also closing a dialog the select sits in.
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(filtered.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (filtered[active]) choose(filtered[active]);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openList();
          }
        }}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-800",
          "bg-white dark:bg-slate-900 dark:text-slate-100",
          error ? "border-red-400 focus:ring-red-400" : "border-slate-300 dark:border-slate-700"
        )}
      >
        <span className={cn("truncate", !selected && "text-slate-400")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 z-40 mt-1 rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
          onKeyDown={onKeyDown}
        >
          <div className="relative border-b border-slate-100 p-2 dark:border-slate-800">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder={searchPlaceholder}
              aria-label="Search options"
              aria-controls={listId}
              className="w-full rounded border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400">No matches</li>
            ) : (
              filtered.map((option, index) => (
                <li
                  key={option.value || "__empty__"}
                  data-index={index}
                  role="option"
                  aria-selected={option.value === value}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(e) => {
                    // Chosen on mousedown so the outside-click handler never
                    // sees the press and closes the list first.
                    e.preventDefault();
                    choose(option);
                  }}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 px-3 py-1.5 text-sm",
                    index === active
                      ? "bg-indigo-50 text-indigo-900 dark:bg-indigo-500/15 dark:text-indigo-100"
                      : "text-slate-700 dark:text-slate-200"
                  )}
                >
                  <Check
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0 text-indigo-600",
                      option.value === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{option.label}</span>
                    {option.hint && <span className="block truncate text-xs text-slate-400">{option.hint}</span>}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
