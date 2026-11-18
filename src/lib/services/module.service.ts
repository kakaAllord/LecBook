import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paginatedResult } from "@/lib/pagination";
import type { ModuleInput, ModuleUpdateInput } from "@/lib/validators/module";
import { ApiError } from "@/lib/api-response";
import { levelLabel } from "@/lib/levels";

const moduleInclude = {
  course: { select: { id: true, name: true } },
  _count: { select: { assessments: true, attendance: true, assignments: true } },
} satisfies Prisma.ModuleInclude;

/** Typing "Level II", "II" or "2" in the search box finds that level's related modules. */
function levelFromSearch(search: string): number | null {
  const match = search.trim().match(/^(?:level\s*)?(iii|ii|i|[123])$/i);
  if (!match) return null;
  const token = match[1].toLowerCase();
  return { i: 1, ii: 2, iii: 3, "1": 1, "2": 2, "3": 3 }[token] ?? null;
}

export async function listModules(
  opts: { search: string; kind?: "CORE" | "RELATED"; level?: number; page: number; pageSize: number },
  scopeIds: string[] | null = null
) {
  const { search, kind, level, page, pageSize } = opts;
  const searchLevel = search ? levelFromSearch(search) : null;
  const where: Prisma.ModuleWhereInput = {
    AND: [
      scopeIds === null ? {} : { id: { in: scopeIds } },
      kind ? { kind } : {},
      level ? { OR: [{ level }, { kind: "CORE" as const }] } : {},
      ...(search
        ? [
            {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { code: { contains: search, mode: "insensitive" as const } },
                { course: { name: { contains: search, mode: "insensitive" as const } } },
                ...(searchLevel ? [{ level: searchLevel }] : []),
              ],
            },
          ]
        : []),
    ],
  };

  const [items, total] = await Promise.all([
    prisma.module.findMany({
      where,
      orderBy: [{ kind: "asc" }, { level: "asc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: moduleInclude,
    }),
    prisma.module.count({ where }),
  ]);

  return paginatedResult(items, total, page, pageSize);
}

export async function listAllModules(scopeIds: string[] | null = null) {
  return prisma.module.findMany({
    where: scopeIds === null ? {} : { id: { in: scopeIds } },
    orderBy: [{ name: "asc" }],
    include: moduleInclude,
  });
}

export async function getModule(id: string) {
  const module_ = await prisma.module.findUnique({ where: { id }, include: moduleInclude });
  if (!module_) throw new ApiError("Module not found", 404);
  return module_;
}

/** Only related modules are created here; a core module is made with its course. */
export async function createModule(data: ModuleInput) {
  return prisma.module.create({
    data: { name: data.name, code: data.code || null, kind: "RELATED", level: data.level },
    include: moduleInclude,
  });
}

export async function updateModule(id: string, data: ModuleUpdateInput) {
  const existing = await getModule(id);

  // A core module is named after its course and runs at every level, so the
  // code is the only thing to change on it. Its name changes with the course.
  if (existing.kind === "CORE") {
    return prisma.module.update({
      where: { id },
      data: { ...(data.code !== undefined ? { code: data.code || null } : {}) },
      include: moduleInclude,
    });
  }

  const levelChanges = data.level !== undefined && data.level !== existing.level;
  if (levelChanges && (existing._count.attendance > 0 || existing._count.assessments > 0)) {
    // Registers and marks were recorded at the old level; moving the module
    // would leave them describing a class that no longer exists.
    throw new ApiError(
      `${existing.name} already has registers or assessments at ${levelLabel(existing.level ?? 1)}. Create a new module for ${levelLabel(data.level!)} instead.`,
      409
    );
  }

  return prisma.$transaction(async (tx) => {
    if (levelChanges) {
      // Lecturers teaching it move with it to the new level.
      await tx.teachingAssignment.updateMany({ where: { moduleId: id }, data: { level: data.level! } });
    }
    return tx.module.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.code !== undefined ? { code: data.code || null } : {}),
        ...(data.level !== undefined ? { level: data.level } : {}),
      },
      include: moduleInclude,
    });
  });
}

export async function deleteModule(id: string) {
  const module_ = await getModule(id);
  if (module_.kind === "CORE") {
    throw new ApiError(
      `${module_.name} is the core module of its course. It is removed only when the course is deleted.`,
      409
    );
  }
  // Deleting cascades to registers and assessments, so a module that has any
  // is kept: the records matter more than tidying the list.
  if (module_._count.attendance > 0 || module_._count.assessments > 0) {
    throw new ApiError(
      `${module_.name} has registers or assessments recorded against it and cannot be deleted.`,
      409
    );
  }
  await prisma.module.delete({ where: { id } });
}
