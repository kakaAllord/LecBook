import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import {
  bufferPdf,
  addReportHeader,
  addParagraph,
  addGeneratedFooter,
  drawTableRow,
  needsPageBreak,
  HEADER_SHADE,
} from "@/lib/pdf";
import { toUtcDayStart, toUtcDayEnd } from "@/lib/date";
import { computeStanding, passes, roundPercentage, scorePercentage } from "@/lib/grading";
import { getSettingsFor } from "@/lib/services/settings.service";
import type { Session } from "@/lib/auth";
import { classCourseLabel, classRoster, resolveClass, type ResolvedClass } from "@/lib/services/teaching.service";
import { moduleAtLevelLabel } from "@/lib/levels";

// Landscape column widths at the 10pt report size. A date column fits "DD/MM"
// with the cell padding either side; the rest is sized for its longest value.
const REG_COL_WIDTH = 90;
const NAME_COL_WIDTH = 130;
const PRESENT_COL_WIDTH = 45;
const PCT_COL_WIDTH = 50;
const DATE_COL_WIDTH = 36;
const ASSESSMENT_COL_WIDTH = 68;
const MARKED_COL_WIDTH = 55;
const AVERAGE_COL_WIDTH = 60;
const SIGNATURE_COL_WIDTH = 90;
const STATUS_COL_WIDTH = 50;

/** "Electrical Installation Level I (EI101) · Electrical, Plumbing" */
function classSubtitle(cls: ResolvedClass) {
  return `${cls.label}${cls.module.code ? ` (${cls.module.code})` : ""} · ${classCourseLabel(cls)}`;
}

export async function generateAttendanceReport(
  session: Session,
  moduleId: string,
  level: number,
  courseId?: string,
  from?: string,
  to?: string
) {
  // Throws unless the session may report on this module at this level.
  const [cls, settings] = await Promise.all([
    resolveClass(session, moduleId, level, courseId ? [courseId] : undefined),
    getSettingsFor(session),
  ]);

  const scopeCourseIds = cls.courses.map((c) => c.id);

  const dateFilter: { gte?: Date; lte?: Date } = {};
  const fromDay = from ? toUtcDayStart(from) : null;
  const toDay = to ? toUtcDayEnd(to) : null;
  if (fromDay) dateFilter.gte = fromDay;
  if (toDay) dateFilter.lte = toDay;

  const records = await prisma.attendance.findMany({
    where: {
      moduleId,
      level: cls.level,
      student: { courseId: { in: scopeCourseIds } },
      ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
    },
    orderBy: { date: "asc" },
  });
  // Students recorded in range stay on the sheet even if they have moved up since.
  const students = await classRoster(
    cls,
    Array.from(new Set(records.map((r) => r.studentId)))
  );

  const dates = Array.from(new Set(records.map((r) => r.date.toISOString()))).sort();

  const presentDatesByStudent = new Map<string, Set<string>>();
  for (const r of records) {
    if (r.status !== "PRESENT") continue;
    if (!presentDatesByStudent.has(r.studentId)) presentDatesByStudent.set(r.studentId, new Set());
    presentDatesByStudent.get(r.studentId)!.add(r.date.toISOString());
  }

  const rangeLabel =
    from && to
      ? `${dayjs(from).format("DD MMM YYYY")} - ${dayjs(to).format("DD MMM YYYY")}`
      : "All recorded dates";

  const subtitle = `${classSubtitle(cls)}\nDate Range: ${rangeLabel}`;

  const pdf = await bufferPdf(
    (doc) => {
      const header = (label: string) =>
        addReportHeader(doc, settings.institutionName, "Attendance Register", label, settings.institutionLogo);

      if (students.length === 0 || dates.length === 0) {
        header(subtitle);
        addParagraph(
          doc,
          students.length === 0
            ? "No active students found for this scope."
            : "No attendance has been recorded for this module yet."
        );
        return;
      }

      const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const fixedWidth =
        REG_COL_WIDTH + NAME_COL_WIDTH + PRESENT_COL_WIDTH + PCT_COL_WIDTH + STATUS_COL_WIDTH + SIGNATURE_COL_WIDTH;
      const datesPerChunk = Math.max(1, Math.floor((usableWidth - fixedWidth) / DATE_COL_WIDTH));

      const chunks: string[][] = [];
      for (let i = 0; i < dates.length; i += datesPerChunk) {
        chunks.push(dates.slice(i, i + datesPerChunk));
      }

      const drawHeaderRow = (chunk: string[]) => {
        drawTableRow(
          doc,
          [
            { text: "Reg. No", width: REG_COL_WIDTH },
            { text: "Name", width: NAME_COL_WIDTH },
            ...chunk.map((d) => ({ text: dayjs(d).format("DD/MM"), width: DATE_COL_WIDTH })),
            { text: "Pres.", width: PRESENT_COL_WIDTH },
            { text: "Att %", width: PCT_COL_WIDTH },
            { text: "Status", width: STATUS_COL_WIDTH },
            { text: "Signature", width: SIGNATURE_COL_WIDTH },
          ],
          { bold: true, shade: HEADER_SHADE, wrap: true }
        );
      };

      const pageLabel = (chunkIndex: number) =>
        chunks.length > 1 ? `${subtitle} · Page ${chunkIndex + 1} of ${chunks.length}` : subtitle;

      chunks.forEach((chunk, chunkIndex) => {
        if (chunkIndex > 0) doc.addPage();
        header(pageLabel(chunkIndex));
        drawHeaderRow(chunk);

        for (const student of students) {
          if (needsPageBreak(doc)) {
            doc.addPage();
            header(pageLabel(chunkIndex));
            drawHeaderRow(chunk);
          }

          const presentDates = presentDatesByStudent.get(student.id) ?? new Set<string>();
          const totalPresent = presentDates.size;
          const pctValue = (totalPresent / dates.length) * 100;
          const meetsThreshold = pctValue >= settings.attendanceThreshold;

          drawTableRow(doc, [
            { text: student.registrationNumber, width: REG_COL_WIDTH },
            { text: student.fullName, width: NAME_COL_WIDTH },
            ...chunk.map((d) => ({ text: "", width: DATE_COL_WIDTH, tick: presentDates.has(d) })),
            { text: String(totalPresent), width: PRESENT_COL_WIDTH },
            { text: `${pctValue.toFixed(0)}%`, width: PCT_COL_WIDTH },
            { text: meetsThreshold ? "OK" : "LOW", width: STATUS_COL_WIDTH, status: { positive: meetsThreshold } },
            // Left blank for physical sign-off.
            { text: "", width: SIGNATURE_COL_WIDTH },
          ]);
        }
      });

      addGeneratedFooter(doc, dayjs().format("DD MMM YYYY, HH:mm"));
    },
    { layout: "landscape" }
  );

  return { pdf, filename: `attendance-${cls.label.replace(/\s+/g, "-")}-${dayjs().format("YYYYMMDD")}.pdf` };
}

export async function generateAssessmentReport(session: Session, assessmentId: string) {
  const [assessment, settings] = await Promise.all([
    prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { module: true, courses: true },
    }),
    getSettingsFor(session),
  ]);
  if (!assessment) throw new ApiError("Assessment not found", 404);

  const marks = await prisma.assessmentMark.findMany({
    where: { assessmentId },
    include: { student: true },
    orderBy: { student: { fullName: "asc" } },
  });

  const values = marks.map((m) => m.marks);
  const total = values.length;
  const average = total > 0 ? values.reduce((a, b) => a + b, 0) / total : 0;
  const averagePct = roundPercentage(scorePercentage(average, assessment.maxMarks));
  const highest = total > 0 ? Math.max(...values) : 0;
  const lowest = total > 0 ? Math.min(...values) : 0;

  const courseLabel = assessment.courses.map((c) => c.name).join(", ");
  const subtitle = `${moduleAtLevelLabel(assessment.module.name, assessment.level)} · ${courseLabel}\n${assessment.name} · ${dayjs(assessment.date).format("DD MMM YYYY")}`;

  // The sheet carries a percentage and a verdict as well as the raw mark: the
  // mark on its own says nothing now that every assessment sets its own total,
  // and the pass mark it is judged against is a percentage. The widths add up
  // to the usable portrait width.
  const colWidths = { reg: 95, name: 120, marks: 65, pct: 50, status: 50, remarks: 60, signature: 75 };

  const drawHeaderRow = (doc: PDFKit.PDFDocument) => {
    drawTableRow(
      doc,
      [
        { text: "Reg. No", width: colWidths.reg },
        { text: "Name", width: colWidths.name },
        { text: `Marks /${assessment.maxMarks}`, width: colWidths.marks },
        { text: "Score", width: colWidths.pct },
        { text: "Status", width: colWidths.status },
        { text: "Remarks", width: colWidths.remarks },
        { text: "Signature", width: colWidths.signature },
      ],
      { bold: true, shade: HEADER_SHADE, wrap: true }
    );
  };

  const pdf = await bufferPdf((doc) => {
    const header = () =>
      addReportHeader(doc, settings.institutionName, "Assessment Report", subtitle, settings.institutionLogo);
    header();

    addParagraph(
      doc,
      `Marked out of: ${assessment.maxMarks}    Total Students: ${total}    Average: ${average.toFixed(1)} (${averagePct}%)    Highest: ${highest}    Lowest: ${lowest}`,
      { bold: true }
    );
    addParagraph(
      doc,
      `Score is the mark as a percentage of ${assessment.maxMarks}. PASS is ${settings.assessmentPassMark}% or above.`,
      { color: "#555555" }
    );
    doc.moveDown(0.8);

    drawHeaderRow(doc);

    for (const mark of marks) {
      if (needsPageBreak(doc)) {
        doc.addPage();
        header();
        drawHeaderRow(doc);
      }
      // Judged on the rounded figure, so the verdict never contradicts the
      // percentage printed beside it on a sheet somebody is asked to sign.
      const percentage = roundPercentage(scorePercentage(mark.marks, assessment.maxMarks));
      const passed = percentage >= settings.assessmentPassMark;
      drawTableRow(doc, [
        { text: mark.student.registrationNumber, width: colWidths.reg },
        { text: mark.student.fullName, width: colWidths.name },
        { text: String(mark.marks), width: colWidths.marks },
        { text: `${percentage}%`, width: colWidths.pct },
        { text: passed ? "PASS" : "FAIL", width: colWidths.status, status: { positive: passed } },
        { text: mark.remarks || "-", width: colWidths.remarks },
        { text: "", width: colWidths.signature },
      ]);
    }

    if (marks.length === 0) {
      addParagraph(doc, "No marks recorded for this assessment yet.");
    }

    addGeneratedFooter(doc, dayjs().format("DD MMM YYYY, HH:mm"));
  });

  return {
    pdf,
    filename: `assessment-${assessment.name.replace(/\s+/g, "-")}-${dayjs().format("YYYYMMDD")}.pdf`,
  };
}

export async function generateAllAssessmentsReport(
  session: Session,
  moduleId: string,
  level: number,
  courseId?: string
) {
  const [cls, settings] = await Promise.all([
    resolveClass(session, moduleId, level, courseId ? [courseId] : undefined),
    getSettingsFor(session),
  ]);
  const scopeCourseIds = cls.courses.map((c) => c.id);

  const assessments = await prisma.assessment.findMany({
    where: { moduleId, level: cls.level, courses: { some: { id: { in: scopeCourseIds } } } },
    orderBy: { date: "asc" },
  });

  const assessmentIds = assessments.map((a) => a.id);
  const marks = assessmentIds.length
    ? await prisma.assessmentMark.findMany({ where: { assessmentId: { in: assessmentIds } } })
    : [];
  const students = await classRoster(
    cls,
    Array.from(new Set(marks.map((m) => m.studentId)))
  );

  const marksByStudent = new Map<string, Map<string, number>>();
  for (const m of marks) {
    if (!marksByStudent.has(m.studentId)) marksByStudent.set(m.studentId, new Map());
    marksByStudent.get(m.studentId)!.set(m.assessmentId, m.marks);
  }

  const subtitle = `${classSubtitle(cls)}\nAll Assessments (${assessments.length}) · Average of each assessment's score, pass mark ${settings.assessmentPassMark}%`;

  const pdf = await bufferPdf(
    (doc) => {
      const header = (label: string) =>
        addReportHeader(doc, settings.institutionName, "Assessment Summary", label, settings.institutionLogo);

      if (students.length === 0 || assessments.length === 0) {
        header(subtitle);
        addParagraph(
          doc,
          students.length === 0
            ? "No active students found for this scope."
            : "No assessments have been recorded for this module yet."
        );
        return;
      }

      const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const fixedWidth =
        REG_COL_WIDTH + NAME_COL_WIDTH + MARKED_COL_WIDTH + AVERAGE_COL_WIDTH + STATUS_COL_WIDTH + SIGNATURE_COL_WIDTH;
      const assessmentsPerChunk = Math.max(1, Math.floor((usableWidth - fixedWidth) / ASSESSMENT_COL_WIDTH));

      const chunks: (typeof assessments)[] = [];
      for (let i = 0; i < assessments.length; i += assessmentsPerChunk) {
        chunks.push(assessments.slice(i, i + assessmentsPerChunk));
      }

      const drawHeaderRow = (chunk: typeof assessments) => {
        drawTableRow(
          doc,
          [
            { text: "Reg. No", width: REG_COL_WIDTH },
            { text: "Name", width: NAME_COL_WIDTH },
            ...chunk.map((a) => ({ text: `${a.name} /${a.maxMarks}`, width: ASSESSMENT_COL_WIDTH })),
            { text: "Marked", width: MARKED_COL_WIDTH },
            { text: "Average", width: AVERAGE_COL_WIDTH },
            { text: "Status", width: STATUS_COL_WIDTH },
            { text: "Signature", width: SIGNATURE_COL_WIDTH },
          ],
          { bold: true, shade: HEADER_SHADE, wrap: true }
        );
      };

      const pageLabel = (chunkIndex: number) =>
        chunks.length > 1 ? `${subtitle} · Page ${chunkIndex + 1} of ${chunks.length}` : subtitle;

      chunks.forEach((chunk, chunkIndex) => {
        if (chunkIndex > 0) doc.addPage();
        header(pageLabel(chunkIndex));
        drawHeaderRow(chunk);

        for (const student of students) {
          if (needsPageBreak(doc)) {
            doc.addPage();
            header(pageLabel(chunkIndex));
            drawHeaderRow(chunk);
          }

          const studentMarks = marksByStudent.get(student.id) ?? new Map<string, number>();
          const standing = computeStanding(
            assessments.map((a) => ({ marks: studentMarks.get(a.id) ?? null, maxMarks: a.maxMarks }))
          );
          const passed = passes(standing, settings.assessmentPassMark);

          drawTableRow(doc, [
            { text: student.registrationNumber, width: REG_COL_WIDTH },
            { text: student.fullName, width: NAME_COL_WIDTH },
            ...chunk.map((a) => ({
              text: studentMarks.has(a.id) ? String(studentMarks.get(a.id)) : "-",
              width: ASSESSMENT_COL_WIDTH,
            })),
            { text: `${standing.graded}/${standing.total}`, width: MARKED_COL_WIDTH },
            { text: standing.graded > 0 ? `${standing.average.toFixed(0)}%` : "-", width: AVERAGE_COL_WIDTH },
            // Nothing marked means no verdict to give: leave the cell empty rather
            // than printing a FAIL against work the student never sat.
            {
              text: standing.graded > 0 ? (passed ? "PASS" : "FAIL") : "",
              width: STATUS_COL_WIDTH,
              status: { positive: passed },
            },
            { text: "", width: SIGNATURE_COL_WIDTH },
          ]);
        }
      });

      addGeneratedFooter(doc, dayjs().format("DD MMM YYYY, HH:mm"));
    },
    { layout: "landscape" }
  );

  return { pdf, filename: `assessments-${cls.label.replace(/\s+/g, "-")}-${dayjs().format("YYYYMMDD")}.pdf` };
}
