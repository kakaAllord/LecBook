import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paginatedResult } from "@/lib/pagination";
import type { CourseInput, CourseUpdateInput } from "@/lib/validators/course";
import { ApiError } from "@/lib/api-response";

/** `scopeIds` of null means "no restriction" (admins); an array restricts to a lecturer's courses. */
function scopeWhere(scopeIds: string[] | null): Prisma.CourseWhereInput {
  return scopeIds === null ? {} : { id: { in: scopeIds } };
}

export async function listCourses(
  search: string,
  page: number,
  pageSize: number,
  scopeIds: string[] | null = null
) {
  const where: Prisma.CourseWhereInput = {
    AND: [
      scopeWhere(scopeIds),
      ...(search ? [{ name: { contains: search, mode: "insensitive" as const } }] : []),
    ],
  };

  const [items, total] = await Promise.all([
    prisma.course.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { students: true } }, coreModule: { select: { id: true, name: true, code: true } } },
    }),
    prisma.course.count({ where }),
  ]);

  return paginatedResult(items, total, page, pageSize);
}

export async function listAllCourses(scopeIds: string[] | null = null) {
  return prisma.course.findMany({ where: scopeWhere(scopeIds), orderBy: { name: "asc" } });
}

export async function getCourse(id: string) {
  const course = await prisma.course.findUnique({
    where: { id },
    include: { _count: { select: { students: true } } },
  });
  if (!course) throw new ApiError("Course not found", 404);
  return course;
}

/**
 * A course arrives with its core module: the one module every student on it
 * takes from Level I to Level III, carrying the course's own name.
 */
export async function createCourse(data: CourseInput) {
  return prisma.course.create({
    data: { name: data.name, coreModule: { create: { name: data.name, kind: "CORE" } } },
    include: { coreModule: true },
  });
}

/** Renaming a course renames its core module with it, so the two never drift apart. */
export async function updateCourse(id: string, data: CourseUpdateInput) {
  await getCourse(id);
  return prisma.course.update({
    where: { id },
    data: {
      ...data,
      ...(data.name !== undefined
        ? { coreModule: { upsert: { create: { name: data.name, kind: "CORE" }, update: { name: data.name } } } }
        : {}),
    },
    include: { coreModule: true },
  });
}

/**
 * A course with students on it cannot be deleted: their records hang off it.
 * Deleting an empty course takes its core module, and that module's
 * assessments, with it.
 */
export async function deleteCourse(id: string) {
  const course = await getCourse(id);
  if (course._count.students > 0) {
    throw new ApiError(
      `${course.name} still has ${course._count.students} student${course._count.students === 1 ? "" : "s"}. Move or remove them first.`,
      409
    );
  }
  await prisma.course.delete({ where: { id } });
}
