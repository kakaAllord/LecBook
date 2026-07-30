import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import type { AssessmentInput, SaveMarksInput } from "@/lib/validators/assessment";

function normalizeDate(date: string) {
  const parsed = dayjs(date);
  if (!parsed.isValid()) throw new ApiError("Invalid date", 422);
  return parsed.startOf("day").toDate();
}

export async function listAssessments(courseId?: string) {
  return prisma.assessment.findMany({
    where: courseId ? { courseId } : {},
    orderBy: { date: "desc" },
    include: {
      course: true,
      assessmentType: true,
      _count: { select: { marks: true } },
    },
  });
}

export async function createAssessment(data: AssessmentInput) {
  const [course, type] = await Promise.all([
    prisma.course.findUnique({ where: { id: data.courseId } }),
    prisma.assessmentType.findUnique({ where: { id: data.assessmentTypeId } }),
  ]);
  if (!course) throw new ApiError("Course not found", 404);
  if (!type) throw new ApiError("Assessment type not found", 404);

  return prisma.assessment.create({
    data: {
      courseId: data.courseId,
      assessmentTypeId: data.assessmentTypeId,
      title: data.title,
      date: normalizeDate(data.date),
    },
    include: { course: true, assessmentType: true },
  });
}

export async function getAssessmentDetail(id: string) {
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: { course: true, assessmentType: true },
  });
  if (!assessment) throw new ApiError("Assessment not found", 404);

  const students = await prisma.student.findMany({
    where: { courseId: assessment.courseId, status: "ACTIVE" },
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
    include: { assessmentType: true },
  });
  if (!assessment) throw new ApiError("Assessment not found", 404);

  const studentIds = input.marks.map((m) => m.studentId);
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds }, courseId: assessment.courseId },
    select: { id: true },
  });
  const validIds = new Set(students.map((s) => s.id));
  const invalid = input.marks.filter((m) => !validIds.has(m.studentId));
  if (invalid.length > 0) {
    throw new ApiError("One or more students do not belong to this course", 422);
  }

  const exceeding = input.marks.filter((m) => m.marks > assessment.assessmentType.maxMarks);
  if (exceeding.length > 0) {
    throw new ApiError(
      `Marks cannot exceed the maximum of ${assessment.assessmentType.maxMarks} for ${assessment.assessmentType.name}`,
      422
    );
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
