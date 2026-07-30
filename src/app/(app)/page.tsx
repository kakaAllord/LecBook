"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Users, BookOpen, ClipboardCheck, ListChecks, FileBarChart, ArrowRight } from "lucide-react";
import dayjs from "dayjs";
import { api } from "@/lib/api-client";
import type { DashboardSummary } from "@/types";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";

const QUICK_LINKS = [
  { href: "/students", label: "Manage Students", description: "Register and update student records", icon: Users },
  { href: "/courses", label: "Manage Courses", description: "Set up courses for the term", icon: BookOpen },
  { href: "/attendance", label: "Take Attendance", description: "Mark today's attendance by course", icon: ClipboardCheck },
  { href: "/assessments", label: "Assessments", description: "Record marks for quizzes, tests and more", icon: ListChecks },
  { href: "/reports", label: "Generate Reports", description: "Download attendance and assessment PDFs", icon: FileBarChart },
];

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardSummary>("/api/dashboard"),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Overview of your students, courses and activity today.
        </p>
      </div>

      {isLoading || !data ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Total Students" value={data.totalStudents} sublabel={`${data.activeStudents} active`} color="indigo" />
            <StatCard icon={BookOpen} label="Courses" value={data.totalCourses} color="sky" />
            <StatCard
              icon={ClipboardCheck}
              label="Today's Attendance"
              value={data.todayAttendance.total}
              sublabel={`${data.todayAttendance.present} present · ${data.todayAttendance.absent} absent`}
              color="emerald"
            />
            <StatCard icon={ListChecks} label="Assessments" value={data.totalAssessments} color="amber" />
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <Link key={link.href} href={link.href}>
                    <Card className="group h-full p-5 transition-shadow hover:shadow-md">
                      <div className="flex items-start justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                          <Icon className="h-5 w-5" />
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-indigo-500" />
                      </div>
                      <p className="mt-3 font-medium text-slate-900 dark:text-slate-100">{link.label}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{link.description}</p>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Assessments</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recentAssessments.length === 0 ? (
                <EmptyState title="No assessments yet" description="Create your first assessment to see it here." />
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.recentAssessments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{a.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {a.assessmentType.name} · {a.course.name}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400">{dayjs(a.date).format("DD MMM YYYY")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
