import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import type { AssessmentTypeInput, AssessmentTypeUpdateInput } from "@/lib/validators/assessment";

export async function listAssessmentTypes() {
  return prisma.assessmentType.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { assessments: true } } },
  });
}

export async function getAssessmentType(id: string) {
  const type = await prisma.assessmentType.findUnique({ where: { id } });
  if (!type) throw new ApiError("Assessment type not found", 404);
  return type;
}

export async function createAssessmentType(data: AssessmentTypeInput) {
  const existing = await prisma.assessmentType.findUnique({ where: { name: data.name } });
  if (existing) throw new ApiError("An assessment type with this name already exists", 409);
  return prisma.assessmentType.create({ data: { ...data, description: data.description || null } });
}

export async function updateAssessmentType(id: string, data: AssessmentTypeUpdateInput) {
  await getAssessmentType(id);
  if (data.name) {
    const existing = await prisma.assessmentType.findUnique({ where: { name: data.name } });
    if (existing && existing.id !== id) {
      throw new ApiError("An assessment type with this name already exists", 409);
    }
  }
  return prisma.assessmentType.update({
    where: { id },
    data: { ...data, description: data.description === "" ? null : data.description },
  });
}

export async function deleteAssessmentType(id: string) {
  await getAssessmentType(id);
  await prisma.assessmentType.delete({ where: { id } });
}
