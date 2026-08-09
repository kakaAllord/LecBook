"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Users,
  Layers,
  ListChecks,
  ClipboardCheck,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api-client";
import type { LecturerDashboard as LecturerDashboardData } from "@/lib/services/dashboard.service";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { RankedBars } from "@/components/charts/RankedBars";

export function LecturerDashboard({ firstName }: { firstName: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<LecturerDashboardData>("/api/dashboard"),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <LoadingSpinner />
      </div>
    );
  }

  const { todayAttendance: today } = data;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Good day, {firstName}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Your students, your modules, and where attendance is slipping.
          </p>
        </div>
        <Link href="/attendance">
          <Button>
            <ClipboardCheck className="h-4 w-4" />
            {today.recorded ? "Review today's register" : "Take today's register"}
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="My Students" value={data.totals.students} color="emerald" />
        <StatCard icon={Layers} label="My Modules" value={data.totals.modules} color="indigo" />
        <StatCard
          icon={ListChecks}
          label="My Assessments"
          value={data.totals.assessments}
          color="amber"
        />
        <StatCard
          icon={ClipboardCheck}
          label="Today's Register"
          value={today.recorded ? `${today.present}/${today.total}` : "Not taken"}
          sublabel={today.recorded ? `${today.absent} absent` : "No register saved today"}
          color={today.recorded ? "sky" : "rose"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Attendance by module</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <RankedBars
              rows={data.attendanceByModule}
              unit="present"
              emptyMessage="No registers taken yet"
            />
            <p className="text-xs text-slate-400">
              Percentages are of every session recorded for the module. Your bar is{" "}
              {data.attendanceThreshold}%.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Below your attendance bar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.atRisk.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                Every student is at or above {data.attendanceThreshold}%.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.atRisk.map((student) => (
                  <li
                    key={student.registrationNumber}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                        {student.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {student.registrationNumber} · {student.sessions} sessions
                      </p>
                    </div>
                    <Badge color="rose">{student.percentage}%</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent assessments</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentAssessments.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              No assessments yet.{" "}
              <Link href="/assessments" className="text-emerald-600 hover:underline">
                Create one
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.recentAssessments.map((assessment) => (
                <li key={assessment.id}>
                  <Link
                    href={`/assessments/${assessment.id}`}
                    className="group flex items-center justify-between gap-4 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                        {assessment.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {assessment.moduleName} · {dayjs(assessment.date).format("DD MMM YYYY")} · max{" "}
                        {assessment.maxMarks}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      {assessment.marksEntered} marked
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
