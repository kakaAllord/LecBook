"use client";

import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/types";

const OPTIONS: { value: AttendanceStatus; label: string; active: string }[] = [
  { value: "PRESENT", label: "Present", active: "bg-emerald-600 text-white border-emerald-600" },
  { value: "ABSENT", label: "Absent", active: "bg-rose-600 text-white border-rose-600" },
  { value: "LATE", label: "Late", active: "bg-amber-500 text-white border-amber-500" },
  { value: "EXCUSED", label: "Excused", active: "bg-sky-600 text-white border-sky-600" },
];

export function AttendanceStatusPicker({
  value,
  onChange,
}: {
  value: AttendanceStatus;
  onChange: (status: AttendanceStatus) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
            value === opt.value
              ? opt.active
              : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
