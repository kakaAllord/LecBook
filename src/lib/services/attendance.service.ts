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

async function getModuleWithCourses(moduleId: string) {
  const module_ = await prisma.module.findUnique({
    where: { id: moduleId },
    include: { courses: true },
  });
  if (!module_) throw new ApiError("Module not found", 404);
  return module_;
}

export async function getAttendanceForDate(moduleId: string, courseIds: string[], date: string) {
  const day = normalizeDate(date);
  const module_ = await getModuleWithCourses(moduleId);

  const moduleCourseIds = new Set(module_.courses.map((c) => c.id));
  const invalidCourses = courseIds.filter((id) => !moduleCourseIds.has(id));
  if (invalidCourses.length > 0) {
    throw new ApiError("One or more selected courses are not linked to this module", 422);
  }

  const students = await prisma.student.findMany({
    where: { courseId: { in: courseIds }, status: "ACTIVE" },
    orderBy: { fullName: "asc" },
  });

  const records = await prisma.attendance.findMany({
    where: { date: day, moduleId, student: { courseId: { in: courseIds } } },
  });
  const byStudent = new Map(records.map((r) => [r.studentId, r]));

  return {
    module: module_,
    courseIds,
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
  const module_ = await getModuleWithCourses(input.moduleId);
  const moduleCourseIds = module_.courses.map((c) => c.id);

  const studentIds = input.records.map((r) => r.studentId);
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds }, courseId: { in: moduleCourseIds } },
    select: { id: true, courseId: true },
  });
  const validIds = new Set(students.map((s) => s.id));
  const invalid = input.records.filter((r) => !validIds.has(r.studentId));
  if (invalid.length > 0) {
    throw new ApiError("One or more students do not belong to a course linked to this module", 422);
  }

  await prisma.$transaction(
    input.records.map((r) =>
      prisma.attendance.upsert({
        where: { studentId_moduleId_date: { studentId: r.studentId, moduleId: input.moduleId, date: day } },
        create: {
          studentId: r.studentId,
          moduleId: input.moduleId,
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

  const courseIds = Array.from(new Set(students.map((s) => s.courseId)));
  return getAttendanceForDate(input.moduleId, courseIds, input.date);
}

export async function getAttendanceHistory(
  moduleId: string,
  courseIds: string[] | undefined,
  from?: string,
  to?: string
) {
  const module_ = await getModuleWithCourses(moduleId);
  const scopeCourseIds = courseIds && courseIds.length > 0 ? courseIds : module_.courses.map((c) => c.id);

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = normalizeDate(from);
  if (to) dateFilter.lte = normalizeDate(to);

  const records = await prisma.attendance.findMany({
    where: {
      moduleId,
      student: { courseId: { in: scopeCourseIds } },
      ...(from || to ? { date: dateFilter } : {}),
    },
    orderBy: { date: "desc" },
  });

  const byDate = new Map<string, { date: Date; present: number; absent: number; total: number }>();

  for (const r of records) {
    const key = r.date.toISOString();
    if (!byDate.has(key)) {
      byDate.set(key, { date: r.date, present: 0, absent: 0, total: 0 });
    }
    const bucket = byDate.get(key)!;
    bucket.total += 1;
    if (r.status === "PRESENT") bucket.present += 1;
    if (r.status === "ABSENT") bucket.absent += 1;
  }

  return Array.from(byDate.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
}
