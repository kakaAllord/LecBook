import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import { MODULE_MARKS_CAP } from "@/lib/validators/assessment";
import type { AssessmentInput, SaveMarksInput } from "@/lib/validators/assessment";

function normalizeDate(date: string) {
  const parsed = dayjs(date);
  if (!parsed.isValid()) throw new ApiError("Invalid date", 422);
  return parsed.startOf("day").toDate();
}

export async function listAssessments(moduleId?: string, courseId?: string) {
  return prisma.assessment.findMany({
    where: {
      ...(moduleId ? { moduleId } : {}),
      ...(courseId ? { courses: { some: { id: courseId } } } : {}),
    },
    orderBy: { date: "desc" },
    include: {
      module: true,
      courses: true,
      _count: { select: { marks: true } },
    },
  });
}

export async function getRemainingMarks(moduleId: string) {
  const module_ = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!module_) throw new ApiError("Module not found", 404);

  const result = await prisma.assessment.aggregate({
    where: { moduleId },
    _sum: { maxMarks: true },
  });
  const used = result._sum.maxMarks ?? 0;
  return { cap: MODULE_MARKS_CAP, used, remaining: Math.max(0, MODULE_MARKS_CAP - used) };
}

export async function createAssessment(data: AssessmentInput) {
  const module_ = await prisma.module.findUnique({
    where: { id: data.moduleId },
    include: { courses: true },
  });
  if (!module_) throw new ApiError("Module not found", 404);

  const moduleCourseIds = new Set(module_.courses.map((c) => c.id));
  const invalidCourses = data.courseIds.filter((id) => !moduleCourseIds.has(id));
  if (invalidCourses.length > 0) {
    throw new ApiError("One or more selected courses are not linked to this module", 422);
  }

  const { used, remaining } = await getRemainingMarks(data.moduleId);
  if (data.maxMarks > remaining) {
    throw new ApiError(
      `Marks exceed what's available for this module: ${remaining} of ${MODULE_MARKS_CAP} remaining (${used} already allocated).`,
      422
    );
  }

  return prisma.assessment.create({
    data: {
      moduleId: data.moduleId,
      name: data.name,
      maxMarks: data.maxMarks,
      date: normalizeDate(data.date),
      courses: { connect: data.courseIds.map((id) => ({ id })) },
    },
    include: { module: true, courses: true },
  });
}

export async function getAssessmentDetail(id: string) {
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: { module: true, courses: true },
  });
  if (!assessment) throw new ApiError("Assessment not found", 404);

  const students = await prisma.student.findMany({
    where: { courseId: { in: assessment.courses.map((c) => c.id) }, status: "ACTIVE" },
    orderBy: { fullName: "asc" },
  });

  const marks = await prisma.assessmentMark.findMany({ where: { assessmentId: id } });
  const byStudent = new Map(marks.map((m) => [m.studentId, m]));

  return {
    assessment,
    students: students.map((s) => ({
      student: s,
      mark: byStudent.get(s.id)
        ? {
            id: byStudent.get(s.id)!.id,
            marks: byStudent.get(s.id)!.marks,
            remarks: byStudent.get(s.id)!.remarks,
          }
        : null,
    })),
  };
}

export async function saveMarks(assessmentId: string, input: SaveMarksInput) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { courses: true },
  });
  if (!assessment) throw new ApiError("Assessment not found", 404);

  const studentIds = input.marks.map((m) => m.studentId);
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds }, courseId: { in: assessment.courses.map((c) => c.id) } },
    select: { id: true },
  });
  const validIds = new Set(students.map((s) => s.id));
  const invalid = input.marks.filter((m) => !validIds.has(m.studentId));
  if (invalid.length > 0) {
    throw new ApiError("One or more students do not belong to this assessment's courses", 422);
  }

  const exceeding = input.marks.filter((m) => m.marks > assessment.maxMarks);
  if (exceeding.length > 0) {
    throw new ApiError(`Marks cannot exceed the maximum of ${assessment.maxMarks} for ${assessment.name}`, 422);
  }

  await prisma.$transaction(
    input.marks.map((m) =>
      prisma.assessmentMark.upsert({
        where: { assessmentId_studentId: { assessmentId, studentId: m.studentId } },
        create: {
          assessmentId,
          studentId: m.studentId,
          marks: m.marks,
          remarks: m.remarks || null,
        },
        update: {
          marks: m.marks,
          remarks: m.remarks || null,
        },
      })
    )
  );

  return getAssessmentDetail(assessmentId);
}

export async function deleteAssessment(id: string) {
  const assessment = await prisma.assessment.findUnique({ where: { id } });
  if (!assessment) throw new ApiError("Assessment not found", 404);
  await prisma.assessment.delete({ where: { id } });
}
