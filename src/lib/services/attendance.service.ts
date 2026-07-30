import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import type { SaveAttendanceInput } from "@/lib/validators/attendance";

function normalizeDate(date: string) {
  const parsed = dayjs(date);
  if (!parsed.isValid()) {
    throw new ApiError("Invalid date", 422);
  }
  return parsed.startOf("day").toDate();
}

export async function getAttendanceForDate(courseId: string, date: string) {
  const day = normalizeDate(date);

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new ApiError("Course not found", 404);

  const students = await prisma.student.findMany({
    where: { courseId, status: "ACTIVE" },
    orderBy: { fullName: "asc" },
  });

  const records = await prisma.attendance.findMany({
    where: { date: day, student: { courseId } },
  });
  const byStudent = new Map(records.map((r) => [r.studentId, r]));

  return {
    course,
    date: day,
    students: students.map((s) => ({
      student: s,
      attendance: byStudent.get(s.id)
        ? {
            id: byStudent.get(s.id)!.id,
            status: byStudent.get(s.id)!.status,
            remarks: byStudent.get(s.id)!.remarks,
          }
        : null,
    })),
  };
}

export async function saveAttendance(input: SaveAttendanceInput) {
  const day = normalizeDate(input.date);

  const course = await prisma.course.findUnique({ where: { id: input.courseId } });
  if (!course) throw new ApiError("Course not found", 404);

  const studentIds = input.records.map((r) => r.studentId);
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds }, courseId: input.courseId },
    select: { id: true },
  });
  const validIds = new Set(students.map((s) => s.id));
  const invalid = input.records.filter((r) => !validIds.has(r.studentId));
  if (invalid.length > 0) {
    throw new ApiError("One or more students do not belong to this course", 422);
  }

  await prisma.$transaction(
    input.records.map((r) =>
      prisma.attendance.upsert({
        where: { studentId_date: { studentId: r.studentId, date: day } },
        create: {
          studentId: r.studentId,
          date: day,
          status: r.status,
          remarks: r.remarks || null,
        },
        update: {
          status: r.status,
          remarks: r.remarks || null,
        },
      })
    )
  );

  return getAttendanceForDate(input.courseId, input.date);
}

export async function getAttendanceHistory(
  courseId: string,
  from?: string,
  to?: string
) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new ApiError("Course not found", 404);

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = normalizeDate(from);
  if (to) dateFilter.lte = normalizeDate(to);

  const records = await prisma.attendance.findMany({
    where: {
      student: { courseId },
      ...(from || to ? { date: dateFilter } : {}),
    },
    orderBy: { date: "desc" },
  });

  const byDate = new Map<
    string,
    { date: Date; present: number; absent: number; late: number; excused: number; total: number }
  >();

  for (const r of records) {
    const key = r.date.toISOString();
    if (!byDate.has(key)) {
      byDate.set(key, { date: r.date, present: 0, absent: 0, late: 0, excused: 0, total: 0 });
    }
    const bucket = byDate.get(key)!;
    bucket.total += 1;
    if (r.status === "PRESENT") bucket.present += 1;
    if (r.status === "ABSENT") bucket.absent += 1;
    if (r.status === "LATE") bucket.late += 1;
    if (r.status === "EXCUSED") bucket.excused += 1;
  }

  return Array.from(byDate.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
}
