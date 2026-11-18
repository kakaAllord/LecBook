import type { Module, Course } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import type { Session } from "@/lib/auth";
import { getAssignments } from "@/lib/scope";
import { classKey, levelLabel, levelsForModule, moduleAtLevelLabel, type Level } from "@/lib/levels";

/**
 * A "class" is a module taught at one level to a set of courses — the thing a
 * register is taken for, an assessment is set for and a report is printed
 * for. Which courses are in it depends on who is asking:
 *
 * - an administrator gets every course the module applies to: its own course
 *   for a core module, every course for a related one;
 * - a lecturer gets only the courses they were assigned it for.
 */

export type ClassCourse = { id: string; name: string };

export type TeachingUnit = {
  /** `moduleId:level`, the value a picker hands back. */
  key: string;
  moduleId: string;
  name: string;
  code: string | null;
  kind: "CORE" | "RELATED";
  level: Level;
  /** "Electrical Installation Level I" */
  label: string;
  courses: ClassCourse[];
};

export type ResolvedClass = {
  module: Module & { course: Course | null };
  level: Level;
  label: string;
  /** The courses in scope, after narrowing to any the caller asked for. */
  courses: ClassCourse[];
  /** Every course this session may use with the class, before narrowing. */
  allowedCourses: ClassCourse[];
};

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/** Every module, at every level it runs, that this session can work with. */
export async function listTeachingUnits(session: Session): Promise<TeachingUnit[]> {
  const rows = await getAssignments(session);

  if (rows === null) {
    const [modules, courses] = await Promise.all([
      prisma.module.findMany({ include: { course: true }, orderBy: { name: "asc" } }),
      prisma.course.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    const units: TeachingUnit[] = [];
    for (const m of modules) {
      for (const level of levelsForModule(m)) {
        units.push(unit(m, level, m.kind === "CORE" && m.course ? [{ id: m.course.id, name: m.course.name }] : courses));
      }
    }
    return sortUnits(units);
  }

  if (rows.length === 0) return [];
  const [modules, courses] = await Promise.all([
    prisma.module.findMany({ where: { id: { in: rows.map((r) => r.moduleId) } } }),
    prisma.course.findMany({ where: { id: { in: rows.map((r) => r.courseId) } }, select: { id: true, name: true } }),
  ]);
  const moduleById = new Map(modules.map((m) => [m.id, m]));
  const courseById = new Map(courses.map((c) => [c.id, c]));

  const grouped = new Map<string, { module: Module; level: Level; courses: ClassCourse[] }>();
  for (const r of rows) {
    const m = moduleById.get(r.moduleId);
    const c = courseById.get(r.courseId);
    if (!m || !c) continue;
    const key = classKey(r.moduleId, r.level);
    if (!grouped.has(key)) grouped.set(key, { module: m, level: r.level as Level, courses: [] });
    grouped.get(key)!.courses.push(c);
  }
  return sortUnits(Array.from(grouped.values()).map((g) => unit(g.module, g.level, g.courses.sort(byName))));
}

function unit(m: Module, level: Level, courses: ClassCourse[]): TeachingUnit {
  return {
    key: classKey(m.id, level),
    moduleId: m.id,
    name: m.name,
    code: m.code,
    kind: m.kind,
    level,
    label: moduleAtLevelLabel(m.name, level),
    courses,
  };
}

function sortUnits(units: TeachingUnit[]) {
  return units.sort((a, b) => a.name.localeCompare(b.name) || a.level - b.level);
}

/**
 * Checks that a session may use a module at a level, and works out which
 * courses that means. `requestedCourseIds` narrows the class; an empty or
 * missing list means every course the session may use.
 */
export async function resolveClass(
  session: Session,
  moduleId: string,
  level: number,
  requestedCourseIds?: string[]
): Promise<ResolvedClass> {
  const module_ = await prisma.module.findUnique({ where: { id: moduleId }, include: { course: true } });
  if (!module_) throw new ApiError("Module not found", 404);

  const levels = levelsForModule(module_);
  if (!levels.includes(level as Level)) {
    throw new ApiError(`${module_.name} is not taught at ${levelLabel(level)}`, 422);
  }

  const rows = await getAssignments(session);
  let allowedCourses: ClassCourse[];
  if (rows === null) {
    allowedCourses =
      module_.kind === "CORE" && module_.course
        ? [{ id: module_.course.id, name: module_.course.name }]
        : await prisma.course.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  } else {
    const courseIds = rows.filter((r) => r.moduleId === moduleId && r.level === level).map((r) => r.courseId);
    if (courseIds.length === 0) {
      throw new ApiError(`You are not assigned to ${moduleAtLevelLabel(module_.name, level)}`, 403);
    }
    allowedCourses = await prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  let courses = allowedCourses;
  if (requestedCourseIds && requestedCourseIds.length > 0) {
    const allowed = new Set(allowedCourses.map((c) => c.id));
    if (requestedCourseIds.some((id) => !allowed.has(id))) {
      throw new ApiError(
        `One or more selected courses do not take ${moduleAtLevelLabel(module_.name, level)}${rows === null ? "" : " with you"}`,
        422
      );
    }
    const wanted = new Set(requestedCourseIds);
    courses = allowedCourses.filter((c) => wanted.has(c.id));
  }

  return {
    module: module_,
    level: level as Level,
    label: moduleAtLevelLabel(module_.name, level),
    courses,
    allowedCourses,
  };
}

/**
 * The students in a class: everyone active at its level on one of its courses,
 * plus anyone named in `alsoInclude` — those with a register entry or mark
 * already recorded for it, who may have moved up a level since and would
 * otherwise drop off the sheet that records them.
 */
export async function classRoster(cls: ResolvedClass, alsoInclude: string[] = []) {
  const courseIds = cls.courses.map((c) => c.id);
  return prisma.student.findMany({
    where: {
      courseId: { in: courseIds },
      OR: [{ status: "ACTIVE", level: cls.level }, ...(alsoInclude.length ? [{ id: { in: alsoInclude } }] : [])],
    },
    orderBy: { fullName: "asc" },
  });
}

export function classCourseLabel(cls: ResolvedClass) {
  return cls.courses.map((c) => c.name).join(", ");
}
