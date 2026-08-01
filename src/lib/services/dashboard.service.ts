import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";

export async function getDashboardSummary() {
  const todayStart = dayjs().startOf("day").toDate();

  const [totalStudents, activeStudents, totalCourses, totalAssessments, todayAttendance, recentAssessments] =
    await Promise.all([
      prisma.student.count(),
      prisma.student.count({ where: { status: "ACTIVE" } }),
      prisma.course.count(),
      prisma.assessment.count(),
      prisma.attendance.groupBy({
        by: ["status"],
        where: { date: todayStart },
        _count: true,
      }),
      prisma.assessment.findMany({
        orderBy: { date: "desc" },
        take: 5,
        include: { course: true, assessmentType: true },
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
