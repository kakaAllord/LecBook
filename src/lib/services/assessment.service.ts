import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import type { Prisma } from "@prisma/client";
import type { Session } from "@/lib/auth";
import type { AssessmentInput, SaveMarksInput } from "@/lib/validators/assessment";
import { getAssignments } from "@/lib/scope";
import { resolveClass } from "@/lib/services/teaching.service";
import { moduleAtLevelLabel } from "@/lib/levels";

function normalizeDate(date: string) {
  const parsed = dayjs(date);
  if (!parsed.isValid()) throw new ApiError("Invalid date", 422);
  return parsed.startOf("day").toDate();
}

/**
 * The assessments a session can see. A lecturer sees the ones set for a module
 * at a level they teach, to at least one of the courses they teach it to — so
 * two lecturers splitting a related module between courses each see their own.
 */
export async function listAssessments(
  session: Session,
  filters: { moduleId?: string; level?: number; courseId?: string }
) {
  const rows = await getAssignments(session);

  let scope: Prisma.AssessmentWhereInput = {};
  if (rows !== null) {
    const units = new Map<string, { moduleId: string; level: number; courseIds: string[] }>();
    for (const r of rows) {
      const key = `${r.moduleId}:${r.level}`;
      if (!units.has(key)) units.set(key, { moduleId: r.moduleId, level: r.level, courseIds: [] });
      units.get(key)!.courseIds.push(r.courseId);
    }
    scope =
      units.size === 0
        ? { id: "__no_assignment__" }
        : {
            OR: Array.from(units.values()).map((u) => ({
              moduleId: u.moduleId,
              level: u.level,
              courses: { some: { id: { in: u.courseIds } } },
            })),
          };
  }

  const assessments = await prisma.assessment.findMany({
    where: {
      AND: [
        scope,
        filters.moduleId ? { moduleId: filters.moduleId } : {},
        filters.level ? { level: filters.level } : {},
        filters.courseId ? { courses: { some: { id: filters.courseId } } } : {},
      ],
    },
    orderBy: { date: "desc" },
    include: {
      module: true,
      courses: true,
      _count: { select: { marks: true } },
    },
  });
  return assessments.map((a) => ({ ...a, label: moduleAtLevelLabel(a.module.name, a.level) }));
}

export async function createAssessment(session: Session, data: AssessmentInput) {
  // Throws unless the session teaches this module at this level to every
  // course chosen.
  const cls = await resolveClass(session, data.moduleId, data.level, data.courseIds);

  // No module-wide allowance to check against: an assessment is marked out of
  // its own total, and the module's result is the average of those scores.
  const assessment = await prisma.assessment.create({
    data: {
      moduleId: data.moduleId,
      level: cls.level,
      name: data.name,
      maxMarks: data.maxMarks,
      date: normalizeDate(data.date),
      courses: { connect: cls.courses.map((c) => ({ id: c.id })) },
    },
    include: { module: true, courses: true },
  });
  return { ...assessment, label: cls.label };
}

/**
 * The students an assessment is marked for: everyone active at its level on
 * its courses, plus anyone who already has a mark and has since moved up.
 */
async function assessmentRoster(assessment: { id: string; level: number; courses: { id: string }[] }) {
  const marks = await prisma.assessmentMark.findMany({ where: { assessmentId: assessment.id } });
  const students = await prisma.student.findMany({
    where: {
      courseId: { in: assessment.courses.map((c) => c.id) },
      OR: [
        { status: "ACTIVE", level: assessment.level },
        ...(marks.length ? [{ id: { in: marks.map((m) => m.studentId) } }] : []),
      ],
    },
    orderBy: { fullName: "asc" },
  });
  return { students, marks };
}

export async function getAssessmentDetail(id: string) {
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: { module: true, courses: true },
  });
  if (!assessment) throw new ApiError("Assessment not found", 404);

  const { students, marks } = await assessmentRoster(assessment);
  const byStudent = new Map(marks.map((m) => [m.studentId, m]));

  return {
    assessment: { ...assessment, label: moduleAtLevelLabel(assessment.module.name, assessment.level) },
    students: students.map((s) => {
      const mark = byStudent.get(s.id);
      return {
        student: s,
        mark: mark ? { id: mark.id, marks: mark.marks, remarks: mark.remarks } : null,
      };
    }),
  };
}

export async function saveMarks(assessmentId: string, input: SaveMarksInput) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { courses: true },
  });
  if (!assessment) throw new ApiError("Assessment not found", 404);

  const { students } = await assessmentRoster(assessment);
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
