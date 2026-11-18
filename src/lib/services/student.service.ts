import { prisma } from "@/lib/prisma";
import { paginatedResult } from "@/lib/pagination";
import type { StudentInput, StudentUpdateInput } from "@/lib/validators/student";
import { ApiError } from "@/lib/api-response";
import type { Prisma } from "@prisma/client";
import { computeStanding, passes, roundPercentage } from "@/lib/grading";
import { getSettings } from "@/lib/services/settings.service";
import { FINAL_LEVEL, levelLabel, moduleAtLevelLabel } from "@/lib/levels";

export async function listStudents(opts: {
  search: string;
  courseId?: string;
  level?: number;
  status?: string;
  page: number;
  pageSize: number;
  /** `{}` for admins; the lecturer's course-and-level pairs otherwise. */
  scopeWhere?: Prisma.StudentWhereInput;
}) {
  const { search, courseId, level, status, page, pageSize, scopeWhere = {} } = opts;

  // Each filter is its own AND clause, so a lecturer filtering by a course they
  // do not teach simply gets nothing rather than slipping out of their scope.
  const where: Prisma.StudentWhereInput = {
    AND: [
      scopeWhere,
      courseId ? { courseId } : {},
      level ? { level } : {},
      status ? { status: status as "ACTIVE" | "INACTIVE" | "COMPLETED" } : {},
      search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { registrationNumber: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };

  const [items, total] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { course: true },
    }),
    prisma.student.count({ where }),
  ]);

  return paginatedResult(items, total, page, pageSize);
}

export async function getStudent(id: string) {
  const student = await prisma.student.findUnique({
    where: { id },
    include: { course: true },
  });
  if (!student) throw new ApiError("Student not found", 404);
  return student;
}

export async function createStudent(data: StudentInput) {
  const existing = await prisma.student.findUnique({
    where: { registrationNumber: data.registrationNumber },
  });
  if (existing) {
    throw new ApiError("A student with this registration number already exists", 409);
  }
  return prisma.student.create({ data: { ...data, phone: data.phone || null } });
}

export async function updateStudent(id: string, data: StudentUpdateInput) {
  await getStudent(id);
  if (data.registrationNumber) {
    const existing = await prisma.student.findUnique({
      where: { registrationNumber: data.registrationNumber },
    });
    if (existing && existing.id !== id) {
      throw new ApiError("A student with this registration number already exists", 409);
    }
  }
  return prisma.student.update({
    where: { id },
    data: { ...data, phone: data.phone === "" ? null : data.phone },
  });
}

export async function deleteStudent(id: string) {
  await getStudent(id);
  await prisma.student.delete({ where: { id } });
}

/** Puts a chosen set of students at one level — the bulk correction tool. */
export async function setStudentLevels(studentIds: string[], level: number) {
  const result = await prisma.student.updateMany({ where: { id: { in: studentIds } }, data: { level } });
  return { updated: result.count };
}

export type PromotionVerdict = "PASSED" | "FAILED" | "NO_MARKS";

export type PromotionCandidate = {
  id: string;
  registrationNumber: string;
  fullName: string;
  course: string;
  verdict: PromotionVerdict;
  modules: { label: string; average: number; passMark: number; passed: boolean; graded: number; total: number }[];
};

/**
 * Who at a level has passed, so the administrator can promote them.
 *
 * A student has passed when every module they were marked in at this level is
 * passed: the average of their assessment percentages for that module reaches
 * the pass mark of the lecturer who teaches it to their course (the
 * institution's when no lecturer has set one). A student with no marks at all
 * gets no verdict — they are listed, but not ticked.
 */
export async function previewPromotion(level: number) {
  const [students, settings] = await Promise.all([
    prisma.student.findMany({
      where: { level, status: "ACTIVE" },
      include: { course: { select: { name: true } } },
      orderBy: [{ course: { name: "asc" } }, { fullName: "asc" }],
    }),
    getSettings(),
  ]);
  if (students.length === 0) return { level, students: [] as PromotionCandidate[] };

  const studentIds = students.map((s) => s.id);
  const courseIds = Array.from(new Set(students.map((s) => s.courseId)));

  const [assessments, assignments] = await Promise.all([
    prisma.assessment.findMany({
      where: { level, courses: { some: { id: { in: courseIds } } } },
      include: {
        module: { select: { id: true, name: true } },
        courses: { select: { id: true } },
        marks: { where: { studentId: { in: studentIds } }, select: { studentId: true, marks: true } },
      },
    }),
    prisma.teachingAssignment.findMany({
      where: { level, courseId: { in: courseIds } },
      include: { lecturer: { select: { assessmentPassMark: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // The first lecturer assigned to a module for a course sets that course's bar.
  const passMarkFor = new Map<string, number>();
  for (const a of assignments) {
    const key = `${a.moduleId}:${a.courseId}`;
    if (!passMarkFor.has(key)) passMarkFor.set(key, a.lecturer.assessmentPassMark ?? settings.assessmentPassMark);
  }

  const candidates: PromotionCandidate[] = students.map((student) => {
    const byModule = new Map<string, { name: string; items: { marks: number | null; maxMarks: number }[] }>();
    for (const a of assessments) {
      if (!a.courses.some((c) => c.id === student.courseId)) continue;
      if (!byModule.has(a.module.id)) byModule.set(a.module.id, { name: a.module.name, items: [] });
      const mark = a.marks.find((m) => m.studentId === student.id);
      byModule.get(a.module.id)!.items.push({ marks: mark?.marks ?? null, maxMarks: a.maxMarks });
    }

    const modules = Array.from(byModule.entries())
      .map(([moduleId, { name, items }]) => {
        const standing = computeStanding(items);
        const passMark = passMarkFor.get(`${moduleId}:${student.courseId}`) ?? settings.assessmentPassMark;
        return {
          label: moduleAtLevelLabel(name, level),
          average: roundPercentage(standing.average),
          passMark,
          passed: passes(standing, passMark),
          graded: standing.graded,
          total: standing.total,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    const graded = modules.filter((m) => m.graded > 0);
    const verdict: PromotionVerdict =
      graded.length === 0 ? "NO_MARKS" : graded.every((m) => m.passed) ? "PASSED" : "FAILED";

    return {
      id: student.id,
      registrationNumber: student.registrationNumber,
      fullName: student.fullName,
      course: student.course.name,
      verdict,
      modules,
    };
  });

  return { level, students: candidates };
}

/**
 * Moves the chosen students up one level, or marks them Completed when they
 * were at the final level. Only students still active at `fromLevel` are
 * touched, so confirming the same list twice cannot promote anyone twice.
 */
export async function promoteStudents(fromLevel: number, studentIds: string[]) {
  const where = { id: { in: studentIds }, level: fromLevel, status: "ACTIVE" as const };
  const result =
    fromLevel >= FINAL_LEVEL
      ? await prisma.student.updateMany({ where, data: { status: "COMPLETED" } })
      : await prisma.student.updateMany({ where, data: { level: fromLevel + 1 } });

  return {
    promoted: result.count,
    skipped: studentIds.length - result.count,
    to: fromLevel >= FINAL_LEVEL ? "Completed" : levelLabel(fromLevel + 1),
  };
}
