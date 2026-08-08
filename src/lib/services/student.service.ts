import { prisma } from "@/lib/prisma";
import { paginatedResult } from "@/lib/pagination";
import type { StudentInput, StudentUpdateInput } from "@/lib/validators/student";
import { ApiError } from "@/lib/api-response";
import type { Prisma } from "@prisma/client";

export async function listStudents(opts: {
  search: string;
  courseId?: string;
  status?: string;
  page: number;
  pageSize: number;
  /** Null for admins; a lecturer's assigned course ids otherwise. */
  scopeCourseIds?: string[] | null;
}) {
  const { search, courseId, status, page, pageSize, scopeCourseIds = null } = opts;

  const where: Prisma.StudentWhereInput = {
    ...(scopeCourseIds !== null ? { courseId: { in: scopeCourseIds } } : {}),
    // An explicit course filter still has to sit inside the caller's scope.
    ...(courseId
      ? scopeCourseIds !== null && !scopeCourseIds.includes(courseId)
        ? { courseId: "__out_of_scope__" }
        : { courseId }
      : {}),
    ...(status ? { status: status as "ACTIVE" | "INACTIVE" } : {}),
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { registrationNumber: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
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
