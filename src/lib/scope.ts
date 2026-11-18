import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import { isAdminRole, type Session } from "@/lib/auth";

/**
 * What a session may see.
 *
 * Admins and super admins see everything. A lecturer sees exactly what their
 * teaching assignments say: a module, at a level, for particular courses. A
 * student is in front of a lecturer when the student's course and level match
 * one of those rows — that pairing is the single hinge the lecturer's view
 * swings on, and nothing else grants access.
 *
 * `null` from any of these means "no restriction".
 */

export type Assignment = { moduleId: string; level: number; courseId: string };

export async function getAssignments(session: Session): Promise<Assignment[] | null> {
  if (isAdminRole(session.role)) return null;
  return prisma.teachingAssignment.findMany({
    where: { lecturerId: session.sub },
    select: { moduleId: true, level: true, courseId: true },
  });
}

export async function getScopedModuleIds(session: Session): Promise<string[] | null> {
  const rows = await getAssignments(session);
  return rows === null ? null : Array.from(new Set(rows.map((r) => r.moduleId)));
}

export async function getScopedCourseIds(session: Session): Promise<string[] | null> {
  const rows = await getAssignments(session);
  return rows === null ? null : Array.from(new Set(rows.map((r) => r.courseId)));
}

/** Matches nothing: a lecturer with no assignments has no students. */
const NO_STUDENTS: Prisma.StudentWhereInput = { id: "__no_assignment__" };

/** Course and level pairs, deduplicated across modules. */
function coursesAtLevels(rows: Assignment[]) {
  const seen = new Map<string, { courseId: string; level: number }>();
  for (const r of rows) seen.set(`${r.courseId}:${r.level}`, { courseId: r.courseId, level: r.level });
  return Array.from(seen.values());
}

/** A Prisma `where` fragment restricting students to the session's scope. */
export async function studentScopeWhere(session: Session): Promise<Prisma.StudentWhereInput> {
  const rows = await getAssignments(session);
  if (rows === null) return {};
  const pairs = coursesAtLevels(rows);
  return pairs.length === 0 ? NO_STUDENTS : { OR: pairs };
}

export async function assertCourseAccess(session: Session, courseId: string) {
  const ids = await getScopedCourseIds(session);
  if (ids !== null && !ids.includes(courseId)) {
    throw new ApiError("You do not teach a module in this course", 403);
  }
}

export async function assertModuleAccess(session: Session, moduleId: string) {
  const ids = await getScopedModuleIds(session);
  if (ids !== null && !ids.includes(moduleId)) {
    throw new ApiError("You are not assigned to this module", 403);
  }
}

/**
 * An assessment belongs to a module at a level, set for certain courses. A
 * lecturer may work with it when they teach that module at that level to at
 * least one of those courses.
 */
export async function assertAssessmentAccess(session: Session, assessmentId: string) {
  const rows = await getAssignments(session);
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { moduleId: true, level: true, courses: { select: { id: true } } },
  });
  if (!assessment) throw new ApiError("Assessment not found", 404);
  if (rows === null) return;
  const courseIds = new Set(assessment.courses.map((c) => c.id));
  const teaches = rows.some(
    (r) => r.moduleId === assessment.moduleId && r.level === assessment.level && courseIds.has(r.courseId)
  );
  if (!teaches) throw new ApiError("You are not assigned to this module at this level", 403);
}

export async function assertStudentAccess(session: Session, studentId: string) {
  const rows = await getAssignments(session);
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { courseId: true, level: true },
  });
  if (!student) throw new ApiError("Student not found", 404);
  if (rows === null) return;
  if (!rows.some((r) => r.courseId === student.courseId && r.level === student.level)) {
    throw new ApiError("This student is not in one of your classes", 403);
  }
}
