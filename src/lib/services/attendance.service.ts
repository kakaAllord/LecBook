import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import { toUtcDayStart } from "@/lib/date";
import type { Session } from "@/lib/auth";
import type { SaveAttendanceInput } from "@/lib/validators/attendance";
import { classRoster, resolveClass } from "@/lib/services/teaching.service";

/**
 * A register belongs to a module at a level, on a date. Who is on it comes from
 * the class (see teaching.service): the active students at that level on the
 * chosen courses, plus anyone already recorded on that day who has since moved
 * up a level.
 */

function normalizeDate(date: string) {
  const day = toUtcDayStart(date);
  if (!day) {
    throw new ApiError("Invalid date", 422);
  }
  return day;
}

export async function getAttendanceForDate(
  session: Session,
  moduleId: string,
  level: number,
  courseIds: string[],
  date: string
) {
  const day = normalizeDate(date);
  const cls = await resolveClass(session, moduleId, level, courseIds);
  const scopeCourseIds = cls.courses.map((c) => c.id);

  const records = await prisma.attendance.findMany({
    where: { date: day, moduleId, level: cls.level, student: { courseId: { in: scopeCourseIds } } },
  });
  const students = await classRoster(
    cls,
    records.map((r) => r.studentId)
  );
  const byStudent = new Map(records.map((r) => [r.studentId, r]));

  return {
    module: cls.module,
    level: cls.level,
    label: cls.label,
    courseIds: scopeCourseIds,
    date: day,
    students: students.map((s) => {
      const record = byStudent.get(s.id);
      return {
        student: s,
        attendance: record ? { id: record.id, status: record.status, remarks: record.remarks } : null,
      };
    }),
  };
}

export async function saveAttendance(session: Session, input: SaveAttendanceInput) {
  const day = normalizeDate(input.date);
  const cls = await resolveClass(session, input.moduleId, input.level);
  const allowedCourseIds = cls.allowedCourses.map((c) => c.id);

  const studentIds = input.records.map((r) => r.studentId);
  const [students, existing] = await Promise.all([
    prisma.student.findMany({
      where: { id: { in: studentIds }, courseId: { in: allowedCourseIds } },
      select: { id: true, courseId: true, level: true },
    }),
    prisma.attendance.findMany({
      where: { moduleId: input.moduleId, date: day, studentId: { in: studentIds } },
      select: { studentId: true },
    }),
  ]);

  // A student belongs on this register when they are at its level now, or
  // were already recorded on it before moving up.
  const alreadyRecorded = new Set(existing.map((r) => r.studentId));
  const validIds = new Set(
    students.filter((s) => s.level === cls.level || alreadyRecorded.has(s.id)).map((s) => s.id)
  );
  if (input.records.some((r) => !validIds.has(r.studentId))) {
    throw new ApiError(`One or more students are not in ${cls.label} on a course you can record`, 422);
  }

  await prisma.$transaction(
    input.records.map((r) =>
      prisma.attendance.upsert({
        where: { studentId_moduleId_date: { studentId: r.studentId, moduleId: input.moduleId, date: day } },
        create: {
          studentId: r.studentId,
          moduleId: input.moduleId,
          level: cls.level,
          date: day,
          status: r.status,
          remarks: r.remarks || null,
          recordedById: session.sub,
        },
        update: {
          level: cls.level,
          status: r.status,
          remarks: r.remarks || null,
          recordedById: session.sub,
        },
      })
    )
  );

  const courseIds = Array.from(new Set(students.map((s) => s.courseId)));
  return getAttendanceForDate(session, input.moduleId, cls.level, courseIds, input.date);
}

/**
 * Repairs a session that was saved against the wrong module, level, date, or
 * set of courses.
 *
 * Attendance is keyed by (student, module, date), so "move" means rewriting that
 * key on the affected rows. Any row already sitting on the destination key is
 * replaced, and students whose course is dropped from the session have their
 * records removed — that is the fix for "the wrong course was marked attending".
 */
export async function moveAttendanceSession(
  session: Session,
  input: {
    moduleId: string;
    level: number;
    date: string;
    courseIds?: string[];
    targetModuleId: string;
    targetLevel: number;
    targetDate: string;
    targetCourseIds?: string[];
  }
) {
  const sourceDay = normalizeDate(input.date);
  const targetDay = normalizeDate(input.targetDate);
  const source = await resolveClass(session, input.moduleId, input.level, input.courseIds);
  const target = await resolveClass(session, input.targetModuleId, input.targetLevel, input.targetCourseIds);

  const records = await prisma.attendance.findMany({
    where: {
      moduleId: input.moduleId,
      level: source.level,
      date: sourceDay,
      student: { courseId: { in: source.courses.map((c) => c.id) } },
    },
    include: { student: { select: { id: true, courseId: true } } },
  });

  if (records.length === 0) {
    throw new ApiError(`There is no saved attendance for ${source.label} on that date`, 404);
  }

  const keep = new Set(target.courses.map((c) => c.id));
  const moving = records.filter((r) => keep.has(r.student.courseId));
  const dropping = records.filter((r) => !keep.has(r.student.courseId));

  if (moving.length === 0) {
    throw new ApiError(`No students in this session are on a course that takes ${target.label}`, 422);
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
          level: target.level,
          date: targetDay,
          recordedById: session.sub,
        },
      })
    ),
  ]);

  return {
    moved: moving.length,
    removed: dropping.length,
    module: target.module,
    label: target.label,
    date: targetDay,
  };
}

/** Deletes a whole saved session — the escape hatch for one recorded in error. */
export async function deleteAttendanceSession(
  session: Session,
  input: { moduleId: string; level: number; date: string; courseIds?: string[] }
) {
  const day = normalizeDate(input.date);
  const cls = await resolveClass(session, input.moduleId, input.level, input.courseIds);

  const result = await prisma.attendance.deleteMany({
    where: {
      moduleId: input.moduleId,
      level: cls.level,
      date: day,
      student: { courseId: { in: cls.courses.map((c) => c.id) } },
    },
  });

  if (result.count === 0) {
    throw new ApiError(`There is no saved attendance for ${cls.label} on that date`, 404);
  }

  return { deleted: result.count, module: cls.module, label: cls.label, date: day };
}

export async function getAttendanceHistory(
  session: Session,
  moduleId: string,
  level: number,
  courseIds: string[] | undefined,
  from?: string,
  to?: string
) {
  const cls = await resolveClass(session, moduleId, level, courseIds);

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = normalizeDate(from);
  if (to) dateFilter.lte = normalizeDate(to);

  const records = await prisma.attendance.findMany({
    where: {
      moduleId,
      level: cls.level,
      student: { courseId: { in: cls.courses.map((c) => c.id) } },
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
