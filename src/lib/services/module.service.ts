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

export async function listModules(search: string, page: number, pageSize: number) {
  const where = search
    ? {
        OR: [{ name: { contains: search } }, { code: { contains: search } }],
      }
    : {};

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

export async function listAllModules() {
  return prisma.module.findMany({
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
      ...(data.courseIds ? { courses: { set: data.courseIds.map((id) => ({ id })) } } : {}),
    },
    include: { courses: true },
  });
}

export async function deleteModule(id: string) {
  await getModule(id);
  await prisma.module.delete({ where: { id } });
}
