import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";

export type MetricsRange = 7 | 30 | 90;

export type UsageMetrics = {
  range: number;
  accounts: {
    total: number;
    admins: number;
    lecturers: number;
    active: number;
    pending: number;
    inactive: number;
    /** Invited accounts that were never activated — a direct onboarding drop-off signal. */
    neverActivated: number;
    medianHoursToActivate: number | null;
  };
  engagement: {
    dau: number;
    wau: number;
    mau: number;
    stickiness: number;
    signInsInRange: number;
    returningUsers: number;
    singleSessionUsers: number;
    neverSignedIn: number;
  };
  devices: {
    byType: { label: string; count: number; share: number }[];
    byBrowser: { label: string; count: number; share: number }[];
    byOs: { label: string; count: number; share: number }[];
    totalSessions: number;
  };
  signInsPerDay: { date: string; count: number }[];
  activityByHour: { hour: number; count: number }[];
  featureUsage: { feature: string; count: number; share: number }[];
  adminLeaderboard: {
    id: string;
    name: string;
    email: string;
    role: string;
    logins: number;
    lastLoginAt: string | null;
    daysSinceLastLogin: number | null;
    accountsAdded: number;
    actionsInRange: number;
    activeDaysInRange: number;
  }[];
  content: {
    students: number;
    activeStudents: number;
    courses: number;
    modules: number;
    assessments: number;
    attendanceRecords: number;
    marksRecorded: number;
    attendanceRecordsInRange: number;
  };
  health: {
    failedSignIns: number;
    deactivations: number;
    deletions: number;
    impersonations: number;
  };
};

function share(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
}

function toDistribution(rows: { label: string | null; count: number }[], total: number) {
  return rows
    .map((r) => ({ label: r.label || "Unknown", count: r.count, share: share(r.count, total) }))
    .sort((a, b) => b.count - a.count);
}

/**
 * The numbers a super admin needs to run this as a business: who is coming back,
 * on what devices, how much work the system is actually carrying, and where
 * onboarding leaks.
 */
export async function getUsageMetrics(rangeDays: MetricsRange = 30): Promise<UsageMetrics> {
  const now = dayjs();
  const rangeStart = now.subtract(rangeDays, "day").startOf("day").toDate();
  const dayStart = now.startOf("day").toDate();
  const weekStart = now.subtract(7, "day").toDate();
  const monthStart = now.subtract(30, "day").toDate();

  const [
    users,
    invites,
    sessionsInRange,
    dauRows,
    wauRows,
    mauRows,
    auditInRange,
    students,
    activeStudents,
    courses,
    modules,
    assessments,
    attendanceRecords,
    attendanceInRange,
    marksRecorded,
  ] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        loginCount: true,
        lastLoginAt: true,
        createdAt: true,
        _count: { select: { createdUsers: true, sessions: true } },
      },
    }),
    prisma.invite.findMany({ select: { createdAt: true, acceptedAt: true } }),
    prisma.userSession.findMany({
      where: { createdAt: { gte: rangeStart } },
      select: { userId: true, createdAt: true, deviceType: true, browser: true, os: true },
    }),
    prisma.userSession.findMany({
      where: { lastSeenAt: { gte: dayStart } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.userSession.findMany({
      where: { lastSeenAt: { gte: weekStart } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.userSession.findMany({
      where: { lastSeenAt: { gte: monthStart } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: rangeStart } },
      select: { userId: true, action: true, createdAt: true },
    }),
    prisma.student.count(),
    prisma.student.count({ where: { status: "ACTIVE" } }),
    prisma.course.count(),
    prisma.module.count(),
    prisma.assessment.count(),
    prisma.attendance.count(),
    prisma.attendance.count({ where: { createdAt: { gte: rangeStart } } }),
    prisma.assessmentMark.count(),
  ]);

  // --- Accounts & onboarding -------------------------------------------------
  const acceptedInvites = invites.filter((i) => i.acceptedAt);
  const hoursToActivate = acceptedInvites
    .map((i) => dayjs(i.acceptedAt).diff(dayjs(i.createdAt), "hour", true))
    .sort((a, b) => a - b);
  const medianHoursToActivate =
    hoursToActivate.length > 0
      ? Math.round(hoursToActivate[Math.floor(hoursToActivate.length / 2)] * 10) / 10
      : null;

  const accounts = {
    total: users.length,
    admins: users.filter((u) => u.role === "ADMIN" || u.role === "SUPER_ADMIN").length,
    lecturers: users.filter((u) => u.role === "LECTURER").length,
    active: users.filter((u) => u.status === "ACTIVE").length,
    pending: users.filter((u) => u.status === "PENDING").length,
    inactive: users.filter((u) => u.status === "INACTIVE").length,
    neverActivated: users.filter((u) => u.status === "PENDING" && !u.lastLoginAt).length,
    medianHoursToActivate,
  };

  // --- Engagement ------------------------------------------------------------
  const dau = dauRows.length;
  const wau = wauRows.length;
  const mau = mauRows.length;

  const engagement = {
    dau,
    wau,
    mau,
    // DAU/MAU — the standard read on how habitual the product is.
    stickiness: share(dau, mau),
    signInsInRange: sessionsInRange.length,
    returningUsers: users.filter((u) => u.loginCount > 1).length,
    singleSessionUsers: users.filter((u) => u.loginCount === 1).length,
    neverSignedIn: users.filter((u) => u.loginCount === 0).length,
  };

  // --- Devices ---------------------------------------------------------------
  const countBy = <T extends string | null>(items: T[]) => {
    const map = new Map<T, number>();
    for (const item of items) map.set(item, (map.get(item) ?? 0) + 1);
    return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
  };

  const totalSessions = sessionsInRange.length;
  const devices = {
    byType: toDistribution(countBy(sessionsInRange.map((s) => s.deviceType as string)), totalSessions),
    byBrowser: toDistribution(countBy(sessionsInRange.map((s) => s.browser)), totalSessions),
    byOs: toDistribution(countBy(sessionsInRange.map((s) => s.os)), totalSessions),
    totalSessions,
  };

  // --- Time series -----------------------------------------------------------
  const perDay = new Map<string, number>();
  for (let i = rangeDays - 1; i >= 0; i--) {
    perDay.set(now.subtract(i, "day").format("YYYY-MM-DD"), 0);
  }
  for (const s of sessionsInRange) {
    const key = dayjs(s.createdAt).format("YYYY-MM-DD");
    if (perDay.has(key)) perDay.set(key, perDay.get(key)! + 1);
  }
  const signInsPerDay = Array.from(perDay.entries()).map(([date, count]) => ({ date, count }));

  const hourBuckets = new Array(24).fill(0) as number[];
  for (const entry of auditInRange) hourBuckets[dayjs(entry.createdAt).hour()] += 1;
  const activityByHour = hourBuckets.map((count, hour) => ({ hour, count }));

  // --- Feature usage ---------------------------------------------------------
  const familyCounts = new Map<string, number>();
  for (const entry of auditInRange) {
    const family = entry.action.split(".")[0];
    familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
  }
  const featureUsage = Array.from(familyCounts.entries())
    .map(([feature, count]) => ({ feature, count, share: share(count, auditInRange.length) }))
    .sort((a, b) => b.count - a.count);

  // --- Per-admin engagement --------------------------------------------------
  const actionsByUser = new Map<string, number>();
  const activeDaysByUser = new Map<string, Set<string>>();
  for (const entry of auditInRange) {
    if (!entry.userId) continue;
    actionsByUser.set(entry.userId, (actionsByUser.get(entry.userId) ?? 0) + 1);
    if (!activeDaysByUser.has(entry.userId)) activeDaysByUser.set(entry.userId, new Set());
    activeDaysByUser.get(entry.userId)!.add(dayjs(entry.createdAt).format("YYYY-MM-DD"));
  }

  const adminLeaderboard = users
    .filter((u) => u.role === "ADMIN" || u.role === "SUPER_ADMIN")
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      logins: u.loginCount,
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      daysSinceLastLogin: u.lastLoginAt ? now.diff(dayjs(u.lastLoginAt), "day") : null,
      accountsAdded: u._count.createdUsers,
      actionsInRange: actionsByUser.get(u.id) ?? 0,
      activeDaysInRange: activeDaysByUser.get(u.id)?.size ?? 0,
    }))
    .sort((a, b) => b.activeDaysInRange - a.activeDaysInRange || b.actionsInRange - a.actionsInRange);

  // --- Health ----------------------------------------------------------------
  const countAction = (prefix: string) =>
    auditInRange.filter((entry) => entry.action.startsWith(prefix)).length;

  return {
    range: rangeDays,
    accounts,
    engagement,
    devices,
    signInsPerDay,
    activityByHour,
    featureUsage,
    adminLeaderboard,
    content: {
      students,
      activeStudents,
      courses,
      modules,
      assessments,
      attendanceRecords,
      marksRecorded,
      attendanceRecordsInRange: attendanceInRange,
    },
    health: {
      failedSignIns: countAction("auth.login_failed"),
      deactivations: countAction("user.deactivate"),
      deletions: auditInRange.filter((e) => e.action.endsWith(".delete")).length,
      impersonations: countAction("user.impersonate_start"),
    },
  };
}
