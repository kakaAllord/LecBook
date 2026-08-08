import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import { toUtcDayStart } from "@/lib/date";
import type { SaveAttendanceInput } from "@/lib/validators/attendance";

function normalizeDate(date: string) {
  const day = toUtcDayStart(date);
  if (!day) {
    throw new ApiError("Invalid date", 422);
  }
  return day;
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

export async function saveAttendance(input: SaveAttendanceInput, recordedById?: string) {
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
          recordedById: recordedById ?? null,
        },
        update: {
          status: r.status,
          remarks: r.remarks || null,
          recordedById: recordedById ?? null,
        },
      })
    )
  );

  const courseIds = Array.from(new Set(students.map((s) => s.courseId)));
  return getAttendanceForDate(input.moduleId, courseIds, input.date);
}

/**
 * Repairs a session that was saved against the wrong module, the wrong date, or
 * the wrong set of courses.
 *
 * Attendance is keyed by (student, module, date), so "move" means rewriting that
 * key on the affected rows. Any row already sitting on the destination key is
 * replaced, and students whose course is dropped from the session have their
 * records removed — that is the fix for "the wrong course was marked attending".
 */
export async function moveAttendanceSession(
  input: {
    moduleId: string;
    date: string;
    courseIds?: string[];
    targetModuleId: string;
    targetDate: string;
    targetCourseIds?: string[];
  },
  recordedById?: string
) {
  const sourceDay = normalizeDate(input.date);
  const targetDay = normalizeDate(input.targetDate);
  const targetModule = await getModuleWithCourses(input.targetModuleId);

  const sourceCourseIds =
    input.courseIds && input.courseIds.length > 0
      ? input.courseIds
      : (await getModuleWithCourses(input.moduleId)).courses.map((c) => c.id);

  const records = await prisma.attendance.findMany({
    where: {
      moduleId: input.moduleId,
      date: sourceDay,
      student: { courseId: { in: sourceCourseIds } },
    },
    include: { student: { select: { id: true, courseId: true } } },
  });

  if (records.length === 0) {
    throw new ApiError("There is no saved attendance for that module and date", 404);
  }

  // Students must belong to a course linked to the destination module, and to
  // the caller's chosen subset of those courses when one was given.
  const targetModuleCourseIds = new Set(targetModule.courses.map((c) => c.id));
  const keepCourseIds =
    input.targetCourseIds && input.targetCourseIds.length > 0
      ? input.targetCourseIds.filter((id) => targetModuleCourseIds.has(id))
      : Array.from(targetModuleCourseIds);

  if (keepCourseIds.length === 0) {
    throw new ApiError("None of the selected courses are linked to the destination module", 422);
  }

  const keep = new Set(keepCourseIds);
  const moving = records.filter((r) => keep.has(r.student.courseId));
  const dropping = records.filter((r) => !keep.has(r.student.courseId));

  if (moving.length === 0) {
    throw new ApiError(
      "No students in this session belong to the destination module's courses",
      422
    );
  }

  await prisma.$transaction([
    // Clear the destination key first so the rewrite cannot collide with an
    // existing record for the same student, module and date.
    prisma.attendance.deleteMany({
      where: {
        moduleId: input.targetModuleId,
        date: targetDay,
        studentId: { in: moving.map((r) => r.studentId) },
        id: { notIn: moving.map((r) => r.id) },
      },
    }),
    ...(dropping.length > 0
      ? [prisma.attendance.deleteMany({ where: { id: { in: dropping.map((r) => r.id) } } })]
      : []),
    ...moving.map((record) =>
      prisma.attendance.update({
        where: { id: record.id },
        data: {
          moduleId: input.targetModuleId,
          date: targetDay,
          recordedById: recordedById ?? record.recordedById,
        },
      })
    ),
  ]);

  return {
    moved: moving.length,
    removed: dropping.length,
    module: targetModule,
    date: targetDay,
  };
}

/** Deletes a whole saved session — the escape hatch for one recorded in error. */
export async function deleteAttendanceSession(input: {
  moduleId: string;
  date: string;
  courseIds?: string[];
}) {
  const day = normalizeDate(input.date);
  const module_ = await getModuleWithCourses(input.moduleId);
  const courseIds =
    input.courseIds && input.courseIds.length > 0
      ? input.courseIds
      : module_.courses.map((c) => c.id);

  const result = await prisma.attendance.deleteMany({
    where: { moduleId: input.moduleId, date: day, student: { courseId: { in: courseIds } } },
  });

  if (result.count === 0) {
    throw new ApiError("There is no saved attendance for that module and date", 404);
  }

  return { deleted: result.count, module: module_, date: day };
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
