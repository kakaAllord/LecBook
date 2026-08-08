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
  Terminal,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import type { UserRole } from "@/types";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

type NavItem = { href: string; label: string; icon: LucideIcon; roles: UserRole[] };

const ALL: UserRole[] = ["SUPER_ADMIN", "ADMIN", "LECTURER"];
const ADMINS: UserRole[] = ["SUPER_ADMIN", "ADMIN"];
const SUPER: UserRole[] = ["SUPER_ADMIN"];

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ALL },
  { href: "/courses", label: "Courses", icon: BookOpen, roles: ADMINS },
  { href: "/modules", label: "Modules", icon: Layers, roles: ADMINS },
  { href: "/students", label: "Students", icon: Users, roles: ALL },
  { href: "/attendance", label: "Attendance", icon: ClipboardCheck, roles: ALL },
  { href: "/assessments", label: "Assessments", icon: ListChecks, roles: ALL },
  { href: "/reports", label: "Reports", icon: FileBarChart, roles: ALL },
  { href: "/admin/users", label: "People", icon: UserCog, roles: ADMINS },
  { href: "/admin/metrics", label: "Metrics", icon: Activity, roles: SUPER },
  { href: "/admin/logs", label: "Activity Log", icon: Terminal, roles: SUPER },
  { href: "/settings", label: "Settings", icon: SettingsIcon, roles: ADMINS },
];

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrator",
  LECTURER: "Lecturer",
};

export function Sidebar({ userName, role }: { userName: string; role: UserRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  const nav = (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {visibleItems.map((item) => {
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
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400"
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
          {settings?.institutionName && (
            <p className="truncate text-xs text-slate-400">{settings.institutionName}</p>
          )}
        </div>
        {nav}
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{userName}</p>
            <p className="text-xs text-slate-400">{ROLE_LABELS[role]}</p>
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
