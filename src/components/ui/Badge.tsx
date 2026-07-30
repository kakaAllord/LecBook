import { cn } from "@/lib/utils";

type BadgeColor = "slate" | "emerald" | "rose" | "amber" | "sky" | "indigo";

const colorClasses: Record<BadgeColor, string> = {
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
};

export function Badge({ color = "slate", children }: { color?: BadgeColor; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", colorClasses[color])}>
      {children}
    </span>
  );
}

export function studentStatusColor(status: string): BadgeColor {
  return status === "ACTIVE" ? "emerald" : "slate";
}

export function attendanceStatusColor(status: string): BadgeColor {
  switch (status) {
    case "PRESENT":
      return "emerald";
    case "ABSENT":
      return "rose";
    case "LATE":
      return "amber";
    case "EXCUSED":
      return "sky";
    default:
      return "slate";
  }
}
