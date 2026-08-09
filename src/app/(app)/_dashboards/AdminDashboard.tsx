"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  BookOpen,
  Layers,
  GraduationCap,
  ClipboardCheck,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api-client";
import type { AdminDashboard as AdminDashboardData } from "@/lib/services/dashboard.service";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { RankedBars } from "@/components/charts/RankedBars";
import { ShareBar } from "@/components/charts/ShareBar";

/** Something the admin has left half set up, with the page that fixes it. */
type Gap = { label: string; count: number; href: string; fix: string };

export function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<AdminDashboardData>("/api/dashboard"),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <LoadingSpinner />
      </div>
    );
  }

  const gaps: Gap[] = [
    {
      label: "modules with no lecturer assigned",
      count: data.gaps.modulesWithoutLecturer,
      href: "/lecturers",
      fix: "Assign one",
    },
    {
      label: "courses with no modules",
      count: data.gaps.coursesWithoutModules,
      href: "/modules",
      fix: "Add modules",
    },
    {
      label: "courses with no students",
      count: data.gaps.coursesWithoutStudents,
      href: "/students",
      fix: "Register students",
    },
    {
      label: "lecturers yet to open their invite",
      count: data.gaps.lecturersAwaitingSetup,
      href: "/lecturers",
      fix: "Resend the link",
    },
  ].filter((gap) => gap.count > 0);

  const attendance = data.todayAttendance;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Everything the institution holds, and what still needs setting up.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total Students"
          value={data.totals.students}
          sublabel={`${data.totals.activeStudents} active`}
          color="sky"
        />
        <StatCard icon={BookOpen} label="Courses" value={data.totals.courses} color="indigo" />
        <StatCard icon={Layers} label="Modules" value={data.totals.modules} color="emerald" />
        <StatCard
          icon={GraduationCap}
          label="Lecturers"
          value={data.totals.lecturers}
          sublabel={
            data.totals.pendingLecturers > 0
              ? `${data.totals.pendingLecturers} awaiting setup`
              : "all set up"
          }
          color="amber"
        />
      </div>

      {gaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Needs your attention
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100 dark:divide-slate-800">
            {gaps.map((gap) => (
              <Link
                key={gap.label}
                href={gap.href}
                className="group flex items-center justify-between gap-4 py-2.5 text-sm first:pt-0 last:pb-0"
              >
                <span className="text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{gap.count}</span>{" "}
                  {gap.label}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400">
                  {gap.fix}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Students per course</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedBars
              rows={data.studentsByCourse}
              unit="students"
              emptyMessage="No students registered yet"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-emerald-600" /> Attendance taken today
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ShareBar
              segments={[
                {
                  label: "Present",
                  count: attendance.present,
                  share: attendance.total > 0 ? Math.round((attendance.present / attendance.total) * 100) : 0,
                },
                {
                  label: "Absent",
                  count: attendance.absent,
                  share: attendance.total > 0 ? Math.round((attendance.absent / attendance.total) * 100) : 0,
                },
              ]}
              emptyMessage="No registers taken today"
            />
            <p className="text-xs text-slate-400">
              Registers are taken by lecturers in their own accounts. This is every module across the
              institution for today.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Teaching load</CardTitle>
        </CardHeader>
        <CardContent>
          <RankedBars
            rows={data.busiestLecturers}
            unit="modules"
            emptyMessage="No modules assigned to lecturers yet"
          />
        </CardContent>
      </Card>
    </div>
  );
}
