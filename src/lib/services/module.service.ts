import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paginatedResult } from "@/lib/pagination";
import type { ModuleInput, ModuleUpdateInput } from "@/lib/validators/module";
import { ApiError } from "@/lib/api-response";

async function assertCoursesExist(courseIds: string[]) {
  const count = await prisma.course.count({ where: { id: { in: courseIds } } });
  if (count !== courseIds.length) {
    throw new ApiError("One or more selected courses were not found", 404);
  }
}

export async function listModules(
  search: string,
  page: number,
  pageSize: number,
  scopeIds: string[] | null = null
) {
  const where: Prisma.ModuleWhereInput = {
    AND: [
      scopeIds === null ? {} : { id: { in: scopeIds } },
      ...(search
        ? [
            {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { code: { contains: search, mode: "insensitive" as const } },
                { level: { contains: search, mode: "insensitive" as const } },
                { semester: { contains: search, mode: "insensitive" as const } },
                { academicYear: { contains: search, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
    ],
  };

  const [items, total] = await Promise.all([
    prisma.module.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { courses: true, _count: { select: { assessments: true } } },
    }),
    prisma.module.count({ where }),
  ]);

  return paginatedResult(items, total, page, pageSize);
}

export async function listAllModules(scopeIds: string[] | null = null) {
  return prisma.module.findMany({
    where: scopeIds === null ? {} : { id: { in: scopeIds } },
    orderBy: { name: "asc" },
    include: { courses: true },
  });
}

export async function getModule(id: string) {
  const module_ = await prisma.module.findUnique({
    where: { id },
    include: { courses: true, _count: { select: { assessments: true } } },
  });
  if (!module_) throw new ApiError("Module not found", 404);
  return module_;
}

export async function createModule(data: ModuleInput) {
  await assertCoursesExist(data.courseIds);
  return prisma.module.create({
    data: {
      name: data.name,
      code: data.code || null,
      level: data.level,
      semester: data.semester,
      academicYear: data.academicYear,
      courses: { connect: data.courseIds.map((id) => ({ id })) },
    },
    include: { courses: true },
  });
}

export async function updateModule(id: string, data: ModuleUpdateInput) {
  await getModule(id);
  if (data.courseIds) await assertCoursesExist(data.courseIds);

  return prisma.module.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.code !== undefined ? { code: data.code || null } : {}),
      ...(data.level !== undefined ? { level: data.level } : {}),
      ...(data.semester !== undefined ? { semester: data.semester } : {}),
      ...(data.academicYear !== undefined ? { academicYear: data.academicYear } : {}),
      ...(data.courseIds ? { courses: { set: data.courseIds.map((id) => ({ id })) } } : {}),
    },
    include: { courses: true },
  });
}

export async function deleteModule(id: string) {
  await getModule(id);
  await prisma.module.delete({ where: { id } });
}
