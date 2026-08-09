"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  BookOpen,
  Layers,
  Users,
  ClipboardCheck,
  ListChecks,
  FileBarChart,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  UserCog,
  GraduationCap,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import type { UserRole } from "@/types";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

type NavItem = { href: string; label: string; icon: LucideIcon };

/**
 * One navigation list per role rather than one list filtered by role. Each
 * account signs into a workspace built for the job it does: the super admin
 * operates the system, the admin runs the institution's records, the lecturer
 * teaches. Nothing from another role's workspace is present to be hidden.
 */
const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  SUPER_ADMIN: [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/users", label: "Users", icon: UserCog },
    { href: "/admin/logs", label: "Logs", icon: Terminal },
  ],
  ADMIN: [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/courses", label: "Courses", icon: BookOpen },
    { href: "/modules", label: "Modules", icon: Layers },
    { href: "/students", label: "Students", icon: Users },
    { href: "/lecturers", label: "Lecturers", icon: GraduationCap },
    { href: "/reports", label: "Reports", icon: FileBarChart },
    { href: "/settings", label: "Settings", icon: SettingsIcon },
  ],
  LECTURER: [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/students", label: "Students", icon: Users },
    { href: "/attendance", label: "Attendance", icon: ClipboardCheck },
    { href: "/assessments", label: "Assessments", icon: ListChecks },
    { href: "/reports", label: "Reports", icon: FileBarChart },
    { href: "/settings", label: "Settings", icon: SettingsIcon },
  ],
};

/**
 * Each workspace carries its own accent, so a glance at the screen — or at a
 * screenshot in a support message — says which account it belongs to. Class
 * names are written out in full because Tailwind only ships classes it can see.
 */
const ROLE_THEME: Record<UserRole, { label: string; workspace: string; active: string; chip: string }> = {
  SUPER_ADMIN: {
    label: "Super Admin",
    workspace: "Operations",
    active: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
    chip: "text-violet-600 dark:text-violet-400",
  },
  ADMIN: {
    label: "Administrator",
    workspace: "Administration",
    active: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
    chip: "text-sky-600 dark:text-sky-400",
  },
  LECTURER: {
    label: "Lecturer",
    workspace: "Teaching",
    active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    chip: "text-emerald-600 dark:text-emerald-400",
  },
};

export function Sidebar({ userName, role }: { userName: string; role: UserRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const theme = ROLE_THEME[role];

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () =>
      api.get<{ institutionName: string; institutionLogo: string | null }>("/api/settings"),
    staleTime: 5 * 60_000,
  });

  const brandMark = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={settings?.institutionLogo || "/logo.svg"}
      alt=""
      className="h-5 w-5 shrink-0 rounded object-contain"
    />
  );

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await api.post("/api/auth/logout");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Failed to log out");
    } finally {
      setLoggingOut(false);
    }
  }

  const nav = (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {NAV_BY_ROLE[role].map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? theme.active
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 lg:hidden dark:border-slate-800">
        <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
          {brandMark}
          LRMS
          <span className={cn("text-xs font-medium", theme.chip)}>{theme.workspace}</span>
        </div>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <aside
        className={cn(
          "w-64 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
          "lg:flex",
          mobileOpen ? "flex" : "hidden"
        )}
      >
        <div className="hidden flex-col gap-1 border-b border-slate-200 px-5 py-4 lg:flex dark:border-slate-800">
          <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
            {brandMark}
            LRMS
          </div>
          <p className={cn("text-xs font-medium uppercase tracking-wide", theme.chip)}>
            {theme.workspace}
          </p>
          {settings?.institutionName && (
            <p className="truncate text-xs text-slate-400">{settings.institutionName}</p>
          )}
        </div>
        {nav}
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{userName}</p>
            <p className="text-xs text-slate-400">{theme.label}</p>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Log out"
              className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
