"use client";

import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/types";

export function AttendanceStatusToggle({
  value,
  onChange,
}: {
  value: AttendanceStatus;
  onChange: (status: AttendanceStatus) => void;
}) {
  const present = value === "PRESENT";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={present}
      aria-label={present ? "Present, tap to mark absent" : "Absent, tap to mark present"}
      onClick={() => onChange(present ? "ABSENT" : "PRESENT")}
      className={cn(
        "relative h-8 w-[92px] shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900",
        present ? "bg-emerald-500 focus-visible:ring-emerald-500" : "bg-rose-500 focus-visible:ring-rose-500"
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center px-2.5 text-xs font-semibold text-white",
          present ? "justify-start" : "justify-end"
        )}
      >
        {present ? "Present" : "Absent"}
      </span>
      <span
        className={cn(
          "pointer-events-none absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200",
          present ? "translate-x-0" : "translate-x-[60px]"
        )}
      />
    </button>
  );
}
