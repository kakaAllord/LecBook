import { prisma } from "@/lib/prisma";
import { todayUtcDayStart } from "@/lib/date";
import type { Session } from "@/lib/auth";
import { getScopedCourseIds, getScopedModuleIds } from "@/lib/scope";
import { getSettingsFor } from "@/lib/services/settings.service";

function share(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

export type AdminDashboard = {
  role: "ADMIN";
  totals: {
    students: number;
    activeStudents: number;
    courses: number;
    modules: number;
    lecturers: number;
    pendingLecturers: number;
  };
  todayAttendance: { present: number; absent: number; total: number };
  studentsByCourse: { label: string; count: number; share: number }[];
  /** Setup work the admin still owes the system, each one a link away from fixed. */
  gaps: {
    modulesWithoutLecturer: number;
    coursesWithoutModules: number;
    coursesWithoutStudents: number;
    lecturersAwaitingSetup: number;
  };
  busiestLecturers: { label: string; count: number; share: number }[];
};

export type LecturerDashboard = {
  role: "LECTURER";
  totals: { students: number; modules: number; assessments: number; sessionsThisWeek: number };
  todayAttendance: { present: number; absent: number; total: number; recorded: boolean };
  attendanceByModule: { label: string; count: number; share: number }[];
  /** Students under the lecturer's own attendance bar, worst first. */
  atRisk: { name: string; registrationNumber: string; percentage: number; sessions: number }[];
  attendanceThreshold: number;
  recentAssessments: {
    id: string;
    name: string;
    date: string;
    moduleName: string;
    maxMarks: number;
    marksEntered: number;
  }[];
};

export type DashboardSummary = AdminDashboard | LecturerDashboard;

/**
 * The institution at a glance: how much of it exists, what was taught today,
 * and what is still half set up.
 */
export async function getAdminDashboard(): Promise<AdminDashboard> {
  const todayStart = todayUtcDayStart();

  const [
    students,
    activeStudents,
    courses,
    modules,
    lecturers,
    pendingLecturers,
    todayAttendance,
    courseRows,
    modulesWithoutLecturer,
    coursesWithoutModules,
    coursesWithoutStudents,
    lecturerRows,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.student.count({ where: { status: "ACTIVE" } }),
    prisma.course.count(),
    prisma.module.count(),
    prisma.user.count({ where: { role: "LECTURER" } }),
    prisma.user.count({ where: { role: "LECTURER", status: "PENDING" } }),
    prisma.attendance.groupBy({ by: ["status"], where: { date: todayStart }, _count: true }),
    prisma.course.findMany({
      select: { name: true, _count: { select: { students: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.module.count({ where: { lecturers: { none: {} } } }),
    prisma.course.count({ where: { modules: { none: {} } } }),
    prisma.course.count({ where: { students: { none: {} } } }),
    prisma.user.findMany({
      where: { role: "LECTURER" },
      select: { name: true, _count: { select: { modules: true } } },
    }),
  ]);

  const attendance = { present: 0, absent: 0, total: 0 };
  for (const row of todayAttendance) {
    attendance.total += row._count;
    if (row.status === "PRESENT") attendance.present = row._count;
    if (row.status === "ABSENT") attendance.absent = row._count;
  }

  const studentsByCourse = courseRows
    .map((c) => ({ label: c.name, count: c._count.students }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((row) => ({ ...row, share: share(row.count, students) }));

  const busiestLecturers = lecturerRows
    .map((l) => ({ label: l.name, count: l._count.modules }))
    .filter((l) => l.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((row) => ({ ...row, share: share(row.count, modules) }));

  return {
    role: "ADMIN",
    totals: {
      students,
      activeStudents,
      courses,
      modules,
      lecturers,
      pendingLecturers,
    },
    todayAttendance: attendance,
    studentsByCourse,
    gaps: {
      modulesWithoutLecturer,
      coursesWithoutModules,
      coursesWithoutStudents,
      lecturersAwaitingSetup: pendingLecturers,
    },
    busiestLecturers,
  };
}

/** What one lecturer is responsible for, and who among their students is slipping. */
export async function getLecturerDashboard(session: Session): Promise<LecturerDashboard> {
  const todayStart = todayUtcDayStart();
  const weekStart = new Date(todayStart);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);

  const [moduleIds, courseIds, settings] = await Promise.all([
    getScopedModuleIds(session),
    getScopedCourseIds(session),
    getSettingsFor(session),
  ]);

  const moduleFilter = moduleIds === null ? {} : { moduleId: { in: moduleIds } };
  const studentFilter = courseIds === null ? {} : { courseId: { in: courseIds } };

  const [students, moduleRows, assessments, sessionDays, todayRows, attendanceRows, recent] =
    await Promise.all([
      prisma.student.count({ where: { ...studentFilter, status: "ACTIVE" } }),
      prisma.module.findMany({
        where: moduleIds === null ? {} : { id: { in: moduleIds } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.assessment.count({ where: moduleFilter }),
      prisma.attendance.findMany({
        where: { ...moduleFilter, date: { gte: weekStart } },
        distinct: ["moduleId", "date"],
        select: { date: true },
      }),
      prisma.attendance.groupBy({
        by: ["status"],
        where: { ...moduleFilter, date: todayStart },
        _count: true,
      }),
      prisma.attendance.groupBy({
        by: ["moduleId", "status"],
        where: moduleFilter,
        _count: true,
      }),
      prisma.assessment.findMany({
        where: moduleFilter,
        orderBy: { date: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          date: true,
          maxMarks: true,
          module: { select: { name: true } },
          _count: { select: { marks: true } },
        },
      }),
    ]);

  const today = { present: 0, absent: 0, total: 0, recorded: false };
  for (const row of todayRows) {
    today.total += row._count;
    if (row.status === "PRESENT") today.present = row._count;
    if (row.status === "ABSENT") today.absent = row._count;
  }
  today.recorded = today.total > 0;

  const moduleNames = new Map(moduleRows.map((m) => [m.id, m.name]));
  const perModule = new Map<string, { present: number; total: number }>();
  for (const row of attendanceRows) {
    const entry = perModule.get(row.moduleId) ?? { present: 0, total: 0 };
    entry.total += row._count;
    if (row.status === "PRESENT") entry.present += row._count;
    perModule.set(row.moduleId, entry);
  }

  const attendanceByModule = Array.from(perModule.entries())
    .map(([moduleId, entry]) => ({
      label: moduleNames.get(moduleId) ?? "Unknown module",
      count: entry.present,
      share: share(entry.present, entry.total),
    }))
    .sort((a, b) => b.share - a.share);

  return {
    role: "LECTURER",
    totals: {
      students,
      modules: moduleRows.length,
      assessments,
      sessionsThisWeek: sessionDays.length,
    },
    todayAttendance: today,
    attendanceByModule,
    atRisk: await getStudentsBelowThreshold(moduleFilter, settings.attendanceThreshold),
    attendanceThreshold: settings.attendanceThreshold,
    recentAssessments: recent.map((a) => ({
      id: a.id,
      name: a.name,
      date: a.date.toISOString(),
      moduleName: a.module.name,
      maxMarks: a.maxMarks,
      marksEntered: a._count.marks,
    })),
  };
}

/**
 * The students the lecturer should chase. Grouped in the database rather than
 * pulled row by row, because a term of registers for a full course is a lot of
 * rows to count in JavaScript.
 */
async function getStudentsBelowThreshold(
  moduleFilter: { moduleId?: { in: string[] } },
  threshold: number
) {
  const rows = await prisma.attendance.groupBy({
    by: ["studentId", "status"],
    where: moduleFilter,
    _count: true,
  });

  const totals = new Map<string, { present: number; total: number }>();
  for (const row of rows) {
    const entry = totals.get(row.studentId) ?? { present: 0, total: 0 };
    entry.total += row._count;
    if (row.status === "PRESENT") entry.present += row._count;
    totals.set(row.studentId, entry);
  }

  const below = Array.from(totals.entries())
    .map(([studentId, entry]) => ({
      studentId,
      percentage: share(entry.present, entry.total),
      sessions: entry.total,
    }))
    .filter((row) => row.sessions > 0 && row.percentage < threshold)
    .sort((a, b) => a.percentage - b.percentage)
    .slice(0, 5);

  if (below.length === 0) return [];

  const students = await prisma.student.findMany({
    where: { id: { in: below.map((r) => r.studentId) } },
    select: { id: true, fullName: true, registrationNumber: true },
  });
  const byId = new Map(students.map((s) => [s.id, s]));

  return below.map((row) => ({
    name: byId.get(row.studentId)?.fullName ?? "Unknown student",
    registrationNumber: byId.get(row.studentId)?.registrationNumber ?? "—",
    percentage: row.percentage,
    sessions: row.sessions,
  }));
}
