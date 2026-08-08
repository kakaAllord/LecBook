import { prisma } from "@/lib/prisma";
import { todayUtcDayStart } from "@/lib/date";

/**
 * Summary for the signed-in account. Admins see the whole institution; a
 * lecturer sees only their assigned courses, so the same dashboard doubles as
 * their personal view — which is also exactly what a super admin sees when
 * viewing as that lecturer.
 */
export async function getDashboardSummary(scope: {
  courseIds: string[] | null;
  moduleIds: string[] | null;
}) {
  // Attendance is keyed by midnight UTC, so "today" must be resolved the same way.
  const todayStart = todayUtcDayStart();

  const studentWhere = scope.courseIds === null ? {} : { courseId: { in: scope.courseIds } };
  const courseWhere = scope.courseIds === null ? {} : { id: { in: scope.courseIds } };
  const assessmentWhere = scope.moduleIds === null ? {} : { moduleId: { in: scope.moduleIds } };
  const attendanceWhere = {
    date: todayStart,
    ...(scope.moduleIds === null ? {} : { moduleId: { in: scope.moduleIds } }),
    ...(scope.courseIds === null ? {} : { student: { courseId: { in: scope.courseIds } } }),
  };

  const [totalStudents, activeStudents, totalCourses, totalAssessments, todayAttendance, recentAssessments] =
    await Promise.all([
      prisma.student.count({ where: studentWhere }),
      prisma.student.count({ where: { ...studentWhere, status: "ACTIVE" } }),
      prisma.course.count({ where: courseWhere }),
      prisma.assessment.count({ where: assessmentWhere }),
      prisma.attendance.groupBy({
        by: ["status"],
        where: attendanceWhere,
        _count: true,
      }),
      prisma.assessment.findMany({
        where: assessmentWhere,
        orderBy: { date: "desc" },
        take: 5,
        include: { module: true, courses: true },
      }),
    ]);

  const todayAttendanceSummary = {
    present: 0,
    absent: 0,
    total: 0,
  };
  for (const row of todayAttendance) {
    todayAttendanceSummary.total += row._count;
    if (row.status === "PRESENT") todayAttendanceSummary.present = row._count;
    if (row.status === "ABSENT") todayAttendanceSummary.absent = row._count;
  }

  return {
    totalStudents,
    activeStudents,
    totalCourses,
    totalAssessments,
    todayAttendance: todayAttendanceSummary,
    recentAssessments,
  };
}
