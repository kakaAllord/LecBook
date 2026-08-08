import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import { isAdminRole, type Session } from "@/lib/auth";

/**
 * The set of courses a session may see.
 *
 * Admins and super admins see everything. A lecturer sees only the courses the
 * admin assigned to them — that assignment is what puts their students in front
 * of them without the lecturer ever registering anyone.
 *
 * `null` means "no restriction".
 */
export async function getScopedCourseIds(session: Session): Promise<string[] | null> {
  if (isAdminRole(session.role)) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { courses: { select: { id: true } } },
  });
  return user?.courses.map((c) => c.id) ?? [];
}

/**
 * The set of modules a session may see: the lecturer's directly assigned
 * modules, plus every module linked to a course they teach.
 */
export async function getScopedModuleIds(session: Session): Promise<string[] | null> {
  if (isAdminRole(session.role)) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      modules: { select: { id: true } },
      courses: { select: { modules: { select: { id: true } } } },
    },
  });
  if (!user) return [];

  const ids = new Set<string>();
  for (const m of user.modules) ids.add(m.id);
  for (const course of user.courses) {
    for (const m of course.modules) ids.add(m.id);
  }
  return Array.from(ids);
}

/** A Prisma `where` fragment restricting a course-owning record to the session's scope. */
export async function courseScopeFilter(session: Session) {
  const ids = await getScopedCourseIds(session);
  return ids === null ? {} : { courseId: { in: ids } };
}

export async function assertCourseAccess(session: Session, courseId: string) {
  const ids = await getScopedCourseIds(session);
  if (ids !== null && !ids.includes(courseId)) {
    throw new ApiError("You are not assigned to this course", 403);
  }
}

export async function assertModuleAccess(session: Session, moduleId: string) {
  const ids = await getScopedModuleIds(session);
  if (ids !== null && !ids.includes(moduleId)) {
    throw new ApiError("You are not assigned to this module", 403);
  }
}

export async function assertStudentAccess(session: Session, studentId: string) {
  const ids = await getScopedCourseIds(session);
  if (ids === null) return;
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { courseId: true },
  });
  if (!student) throw new ApiError("Student not found", 404);
  if (!ids.includes(student.courseId)) {
    throw new ApiError("This student is not in one of your courses", 403);
  }
}
