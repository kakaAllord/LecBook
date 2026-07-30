import { prisma } from "@/lib/prisma";
import { paginatedResult } from "@/lib/pagination";
import type { CourseInput, CourseUpdateInput } from "@/lib/validators/course";
import { ApiError } from "@/lib/api-response";

export async function listCourses(search: string, page: number, pageSize: number) {
  const where = search
    ? {
        OR: [
          { name: { contains: search } },
          { level: { contains: search } },
          { semester: { contains: search } },
          { academicYear: { contains: search } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.course.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { students: true } } },
    }),
    prisma.course.count({ where }),
  ]);

  return paginatedResult(items, total, page, pageSize);
}

export async function listAllCourses() {
  return prisma.course.findMany({ orderBy: { name: "asc" } });
}

export async function getCourse(id: string) {
  const course = await prisma.course.findUnique({
    where: { id },
    include: { _count: { select: { students: true } } },
  });
  if (!course) throw new ApiError("Course not found", 404);
  return course;
}

export async function createCourse(data: CourseInput) {
  return prisma.course.create({ data });
}

export async function updateCourse(id: string, data: CourseUpdateInput) {
  await getCourse(id);
  return prisma.course.update({ where: { id }, data });
}

export async function deleteCourse(id: string) {
  await getCourse(id);
  await prisma.course.delete({ where: { id } });
}
