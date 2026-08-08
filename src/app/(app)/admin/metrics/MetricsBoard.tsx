"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Users,
  UserCheck,
  Repeat,
  Activity,
  MonitorSmartphone,
  ClipboardCheck,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { api } from "@/lib/api-client";
import type { UsageMetrics } from "@/lib/services/metrics.service";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { RankedBars } from "@/components/charts/RankedBars";
import { ShareBar } from "@/components/charts/ShareBar";

const RANGES = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

const DEVICE_LABELS: Record<string, string> = {
  DESKTOP: "Computer",
  MOBILE: "Phone",
  TABLET: "Tablet",
  UNKNOWN: "Unidentified",
};

const FEATURE_LABELS: Record<string, string> = {
  auth: "Signing in",
  user: "Account management",
  student: "Student records",
  course: "Courses",
  module: "Modules",
  attendance: "Attendance",
  assessment: "Assessments",
  report: "Reports",
  settings: "Settings",
};

export function MetricsBoard() {
  const [range, setRange] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-metrics", range],
    queryFn: () => api.get<UsageMetrics>(`/api/admin/metrics?range=${range}`),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Metrics</h1>
        <LoadingSpinner />
      </div>
    );
  }

  const onboardingRate =
    data.accounts.total > 0 ? Math.round((data.accounts.active / data.accounts.total) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Metrics</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            How the system is actually being used — who returns, on what, and how much work it carries.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-200 p-1 dark:border-slate-800">
          {RANGES.map((r) => (
            <Button
              key={r.value}
              size="sm"
              variant={range === r.value ? "primary" : "ghost"}
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {/* ---------- Engagement headline ---------- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Engagement
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Activity}
            label="Active today"
            value={data.engagement.dau}
            sublabel={`${data.engagement.wau} this week · ${data.engagement.mau} this month`}
            color="indigo"
          />
          <StatCard
            icon={Repeat}
            label="Stickiness"
            value={`${data.engagement.stickiness}%`}
            sublabel="Daily actives as a share of monthly"
            color="emerald"
          />
          <StatCard
            icon={UserCheck}
            label="Returning accounts"
            value={data.engagement.returningUsers}
            sublabel={`${data.engagement.singleSessionUsers} signed in once · ${data.engagement.neverSignedIn} never`}
            color="sky"
          />
          <StatCard
            icon={MonitorSmartphone}
            label={`Sign-ins (${range}d)`}
            value={data.engagement.signInsInRange}
            sublabel={`${data.devices.totalSessions} device sessions`}
            color="amber"
          />
        </div>
      </section>

      {/* ---------- Trend ---------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sign-ins per day</CardTitle>
          </CardHeader>
          <CardContent>
            <ColumnChart
              points={data.signInsPerDay.map((d) => ({
                label: d.date,
                value: d.count,
                caption: dayjs(d.date).format("DD MMM"),
              }))}
              valueLabel="sign-ins"
              emptyMessage="No sign-ins in this period"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-600" /> Busiest hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ColumnChart
              points={data.activityByHour.map((h) => ({
                label: String(h.hour),
                value: h.count,
                caption: `${String(h.hour).padStart(2, "0")}:00`,
              }))}
              valueLabel="actions"
              height={140}
              emptyMessage="No activity in this period"
            />
            <p className="mt-3 text-xs text-slate-400">
              When work actually happens — useful for scheduling maintenance windows.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ---------- Devices ---------- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Devices &amp; platforms
        </h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Phones vs computers</CardTitle>
            </CardHeader>
            <CardContent>
              <ShareBar
                segments={data.devices.byType.map((d) => ({
                  ...d,
                  label: DEVICE_LABELS[d.label] ?? d.label,
                }))}
              />
              <p className="mt-4 text-xs text-slate-400">
                A phone-heavy split is the case for investing in the mobile layouts first.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Browsers</CardTitle>
            </CardHeader>
            <CardContent>
              <RankedBars rows={data.devices.byBrowser} unit="sessions" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Operating systems</CardTitle>
            </CardHeader>
            <CardContent>
              <RankedBars rows={data.devices.byOs} unit="sessions" />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ---------- Accounts & onboarding ---------- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Accounts &amp; onboarding
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Users}
            label="Accounts"
            value={data.accounts.total}
            sublabel={`${data.accounts.admins} admin · ${data.accounts.lecturers} lecturer`}
            color="indigo"
          />
          <StatCard
            icon={UserCheck}
            label="Activated"
            value={`${onboardingRate}%`}
            sublabel={`${data.accounts.active} active · ${data.accounts.pending} awaiting setup`}
            color="emerald"
          />
          <StatCard
            icon={Clock}
            label="Time to activate"
            value={
              data.accounts.medianHoursToActivate === null
                ? "—"
                : data.accounts.medianHoursToActivate < 24
                  ? `${data.accounts.medianHoursToActivate}h`
                  : `${Math.round(data.accounts.medianHoursToActivate / 24)}d`
            }
            sublabel="Median from invite to first password"
            color="sky"
          />
          <StatCard
            icon={AlertTriangle}
            label="Never activated"
            value={data.accounts.neverActivated}
            sublabel="Invited but never finished setup"
            color={data.accounts.neverActivated > 0 ? "amber" : "emerald"}
          />
        </div>
      </section>

      {/* ---------- Admin engagement ---------- */}
      <Card>
        <CardHeader>
          <CardTitle>Which administrators keep coming back</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.adminLeaderboard.length === 0 ? (
            <p className="p-5 text-sm text-slate-400">No administrator accounts yet.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Administrator</TH>
                  <TH>Active days</TH>
                  <TH>Actions</TH>
                  <TH>Total sign-ins</TH>
                  <TH>Accounts added</TH>
                  <TH>Last seen</TH>
                </TR>
              </THead>
              <TBody>
                {data.adminLeaderboard.map((admin) => (
                  <TR key={admin.id}>
                    <TD className="font-medium text-slate-900 dark:text-slate-100">
                      <div>{admin.name}</div>
                      <div className="text-xs font-normal text-slate-400">{admin.email}</div>
                    </TD>
                    <TD>
                      {admin.activeDaysInRange} / {range}
                    </TD>
                    <TD>{admin.actionsInRange}</TD>
                    <TD>{admin.logins}</TD>
                    <TD>{admin.accountsAdded}</TD>
                    <TD>
                      {admin.lastLoginAt ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">
                            {dayjs(admin.lastLoginAt).format("DD MMM YYYY")}
                          </span>
                          {admin.daysSinceLastLogin !== null && admin.daysSinceLastLogin > 14 && (
                            <Badge color="amber">dormant</Badge>
                          )}
                        </div>
                      ) : (
                        <Badge color="rose">never</Badge>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ---------- Workload & feature usage ---------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>What the system is used for</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedBars
              rows={data.featureUsage.map((f) => ({
                label: FEATURE_LABELS[f.feature] ?? f.feature,
                count: f.count,
                share: f.share,
              }))}
              unit="actions"
              emptyMessage="No recorded activity in this period"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-indigo-600" /> Records under management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                ["Students", data.content.students, `${data.content.activeStudents} active`],
                ["Courses", data.content.courses],
                ["Modules", data.content.modules],
                ["Assessments", data.content.assessments],
                ["Attendance records", data.content.attendanceRecords, `${data.content.attendanceRecordsInRange} in range`],
                ["Marks recorded", data.content.marksRecorded],
              ].map(([label, value, hint]) => (
                <div key={String(label)}>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
                  <dd className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    {Number(value).toLocaleString()}
                  </dd>
                  {hint && <p className="text-xs text-slate-400">{hint}</p>}
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-slate-400">
              Volume is what a per-student or per-seat price is anchored to — and what storage and
              backup costs scale with.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ---------- Security signals ---------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Security signals ({range} days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Failed sign-ins", data.health.failedSignIns],
              ["Accounts deactivated", data.health.deactivations],
              ["Records deleted", data.health.deletions],
              ["View-as sessions", data.health.impersonations],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {Number(value).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
