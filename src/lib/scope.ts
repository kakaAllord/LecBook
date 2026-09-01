import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import { isAdminRole, type Session } from "@/lib/auth";

/**
 * The set of modules a session may see.
 *
 * Admins and super admins see everything. A lecturer sees exactly the modules
 * the admin assigned to them — module assignment is the single hinge the whole
 * lecturer view swings on.
 *
 * `null` means "no restriction".
 */
export async function getScopedModuleIds(session: Session): Promise<string[] | null> {
  if (isAdminRole(session.role)) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { modules: { select: { id: true } } },
  });
  return user?.modules.map((m) => m.id) ?? [];
}

/**
 * The set of courses a session may see: every course linked to a module they
 * teach. A lecturer is never assigned a course directly — teaching a module is
 * what puts that module's students in front of them without the lecturer ever
 * registering anyone.
 */
export async function getScopedCourseIds(session: Session): Promise<string[] | null> {
  if (isAdminRole(session.role)) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { modules: { select: { courses: { select: { id: true } } } } },
  });
  if (!user) return [];

  const ids = new Set<string>();
  for (const module_ of user.modules) {
    for (const course of module_.courses) ids.add(course.id);
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
 * An assessment belongs to a module, so the module the assessment sits in
 * decides who may read it, mark it or delete it.
 */
export async function assertAssessmentAccess(session: Session, assessmentId: string) {
  const ids = await getScopedModuleIds(session);
  if (ids === null) return;
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { moduleId: true },
  });
  if (!assessment) throw new ApiError("Assessment not found", 404);
  if (!ids.includes(assessment.moduleId)) {
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
    throw new ApiError("This student is not in one of your modules", 403);
  }
}
