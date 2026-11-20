import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import {
  bufferPdf,
  addReportHeader,
  addParagraph,
  drawTableRow,
  fillWidth,
  fitColumn,
  wordFitWidth,
  usableWidth,
  HEADER_SHADE,
  type TableCell,
} from "@/lib/pdf";
import { toUtcDayStart, toUtcDayEnd } from "@/lib/date";
import { computeStanding, passes, roundPercentage, scorePercentage } from "@/lib/grading";
import { getSettingsFor } from "@/lib/services/settings.service";
import type { Session } from "@/lib/auth";
import { classCourseLabel, classRoster, resolveClass, type ResolvedClass } from "@/lib/services/teaching.service";
import { moduleAtLevelLabel } from "@/lib/levels";

// Landscape column widths at the 10pt report size, each sized for its longest
// value with the cell padding either side. The name column takes whatever the
// page has left, and never less than NAME_MIN_WIDTH. A date column fits a bold
// "DD/MM". Reg. No is sized to the longest number on the sheet, and each
// assessment column to the longest word in its heading, within these bounds.
const REG_COL = { min: 70, max: 130 };
const ASSESSMENT_COL = { min: 48, max: 110 };
const NAME_MIN_WIDTH = 125;
const PRESENT_COL_WIDTH = 40;
const PCT_COL_WIDTH = 45;
const DATE_COL_WIDTH = 38;
const MARKED_COL_WIDTH = 50;
const AVERAGE_COL_WIDTH = 55;
const SIGNATURE_COL_WIDTH = 75;
const STATUS_COL_WIDTH = 50;

const generatedAt = () => dayjs().format("DD MMM YYYY, HH:mm");

/**
 * Splits columns into the blocks that fit across a page, filling each block
 * while the next column still fits in `available`, and names each block by
 * what it holds ("Sessions 9–16 of 22"). The page number lives in the footer;
 * a block label that said "Page 1 of 3" on page two misled people.
 */
function packBlocks<T>(items: T[], widthOf: (item: T) => number, available: number, noun: string) {
  const groups: T[][] = [];
  let current: T[] = [];
  let used = 0;
  for (const item of items) {
    const width = widthOf(item);
    if (current.length > 0 && used + width > available) {
      groups.push(current);
      current = [];
      used = 0;
    }
    current.push(item);
    used += width;
  }
  if (current.length > 0) groups.push(current);

  let start = 0;
  return groups.map((group) => {
    const label = groups.length > 1 ? `${noun} ${start + 1}–${start + group.length} of ${items.length}` : "";
    start += group.length;
    return { items: group, label };
  });
}

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
      let pages = 0;
      const header = (label: string) =>
        addReportHeader(doc, settings.institutionName, "Attendance Register", label, settings.institutionLogo, {
          continued: pages++ > 0,
        });

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

      const regWidth = fitColumn(doc, ["Reg. No", ...students.map((st) => st.registrationNumber)], { ...REG_COL, bold: true });
      const fixedWidth =
        regWidth + PRESENT_COL_WIDTH + PCT_COL_WIDTH + STATUS_COL_WIDTH + SIGNATURE_COL_WIDTH;
      const blocks = packBlocks(dates, () => DATE_COL_WIDTH, usableWidth(doc) - fixedWidth - NAME_MIN_WIDTH, "Sessions");

      blocks.forEach((block, blockIndex) => {
        const [reg, name, ...rest] = fillWidth(
          [regWidth, NAME_MIN_WIDTH, ...block.items.map(() => DATE_COL_WIDTH), PRESENT_COL_WIDTH, PCT_COL_WIDTH, STATUS_COL_WIDTH, SIGNATURE_COL_WIDTH],
          usableWidth(doc),
          1
        );
        const [present, pct, status, signature] = rest.slice(block.items.length);
        const label = block.label ? `${subtitle} · ${block.label}` : subtitle;

        const drawHeaderRow = () =>
          drawTableRow(
            doc,
            [
              { text: "Reg. No", width: reg },
              { text: "Name", width: name },
              ...block.items.map((d) => ({ text: dayjs(d).format("DD/MM"), width: DATE_COL_WIDTH })),
              { text: "Pres.", width: present },
              { text: "Att %", width: pct },
              { text: "Status", width: status },
              { text: "Signature", width: signature },
            ],
            { bold: true, shade: HEADER_SHADE }
          );
        const newPage = () => {
          header(label);
          drawHeaderRow();
        };

        if (blockIndex > 0) doc.addPage();
        newPage();

        for (const student of students) {
          const presentDates = presentDatesByStudent.get(student.id) ?? new Set<string>();
          const totalPresent = presentDates.size;
          const pctValue = (totalPresent / dates.length) * 100;
          const meetsThreshold = pctValue >= settings.attendanceThreshold;

          drawTableRow(
            doc,
            [
              { text: student.registrationNumber, width: reg },
              { text: student.fullName, width: name },
              ...block.items.map((d) => ({ text: "", width: DATE_COL_WIDTH, tick: presentDates.has(d) })),
              { text: String(totalPresent), width: present },
              { text: `${pctValue.toFixed(0)}%`, width: pct },
              { text: meetsThreshold ? "OK" : "LOW", width: status, status: { positive: meetsThreshold } },
              // Left blank for physical sign-off.
              { text: "", width: signature },
            ],
            { newPage }
          );
        }
      });
    },
    { layout: "landscape", footer: { generatedAt: generatedAt() } }
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
  // and the pass mark it is judged against is a percentage. The name column
  // takes what the portrait width leaves.
  const pdf = await bufferPdf(
    (doc) => {
      const [reg, name, marksCol, pct, status, remarks, signature] = fillWidth(
        [fitColumn(doc, ["Reg. No", ...marks.map((m) => m.student.registrationNumber)], { ...REG_COL, bold: true }), 0, 45, 45, 45, 90, 60],
        usableWidth(doc),
        1
      );
      let pages = 0;
      const header = () =>
        addReportHeader(doc, settings.institutionName, "Assessment Report", subtitle, settings.institutionLogo, {
          continued: pages++ > 0,
        });
      const drawHeaderRow = () =>
        drawTableRow(
          doc,
          [
            { text: "Reg. No", width: reg },
            { text: "Name", width: name },
            // On two lines for the same reason as the summary's headings.
            { text: `Marks\n/${assessment.maxMarks}`, width: marksCol },
            { text: "Score", width: pct },
            { text: "Status", width: status },
            { text: "Remarks", width: remarks },
            { text: "Signature", width: signature },
          ],
          { bold: true, shade: HEADER_SHADE }
        );
      const newPage = () => {
        header();
        drawHeaderRow();
      };

      header();
      addParagraph(
        doc,
        total > 0
          ? `Marked out of: ${assessment.maxMarks}    Students marked: ${total}    Average: ${average.toFixed(1)} (${averagePct}%)    Highest: ${highest}    Lowest: ${lowest}`
          : `Marked out of: ${assessment.maxMarks}    Students marked: 0`,
        { bold: true }
      );
      addParagraph(
        doc,
        `Score is the mark as a percentage of ${assessment.maxMarks}. PASS is ${settings.assessmentPassMark}% or above.`,
        { color: "#555555" }
      );
      doc.moveDown(0.8);

      if (marks.length === 0) {
        addParagraph(doc, "No marks recorded for this assessment yet.");
        return;
      }

      drawHeaderRow();
      for (const mark of marks) {
        // Judged on the rounded figure, so the verdict never contradicts the
        // percentage printed beside it on a sheet somebody is asked to sign.
        const percentage = roundPercentage(scorePercentage(mark.marks, assessment.maxMarks));
        const passed = percentage >= settings.assessmentPassMark;
        drawTableRow(
          doc,
          [
            { text: mark.student.registrationNumber, width: reg },
            { text: mark.student.fullName, width: name },
            { text: String(mark.marks), width: marksCol },
            { text: `${percentage}%`, width: pct },
            { text: passed ? "PASS" : "FAIL", width: status, status: { positive: passed } },
            { text: mark.remarks || "-", width: remarks },
            { text: "", width: signature },
          ],
          { newPage }
        );
      }
    },
    { footer: { generatedAt: generatedAt() } }
  );

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
      let pages = 0;
      const header = (label: string) =>
        addReportHeader(doc, settings.institutionName, "Assessment Summary", label, settings.institutionLogo, {
          continued: pages++ > 0,
        });

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

      const regWidth = fitColumn(doc, ["Reg. No", ...students.map((st) => st.registrationNumber)], { ...REG_COL, bold: true });
      const fixedWidth =
        regWidth + MARKED_COL_WIDTH + AVERAGE_COL_WIDTH + STATUS_COL_WIDTH + SIGNATURE_COL_WIDTH;
      // The total goes on its own line: line-breaking rules forbid a break
      // before "/" even after a space, so "Examination /100" on one line is a
      // single unbreakable word that pdfkit would cut mid-letter instead.
      const headingOf = (a: (typeof assessments)[number]) => `${a.name}\n/${a.maxMarks}`;
      const widthOf = new Map(
        assessments.map((a) => [a.id, wordFitWidth(doc, headingOf(a), { ...ASSESSMENT_COL, bold: true })])
      );
      const blocks = packBlocks(
        assessments,
        (a) => widthOf.get(a.id)!,
        usableWidth(doc) - fixedWidth - NAME_MIN_WIDTH,
        "Assessments"
      );

      blocks.forEach((block, blockIndex) => {
        const [reg, name, ...rest] = fillWidth(
          [regWidth, NAME_MIN_WIDTH, ...block.items.map((a) => widthOf.get(a.id)!), MARKED_COL_WIDTH, AVERAGE_COL_WIDTH, STATUS_COL_WIDTH, SIGNATURE_COL_WIDTH],
          usableWidth(doc),
          1
        );
        const [markedCol, averageCol, status, signature] = rest.slice(block.items.length);
        const label = block.label ? `${subtitle} · ${block.label}` : subtitle;

        const drawHeaderRow = () =>
          drawTableRow(
            doc,
            [
              { text: "Reg. No", width: reg },
              { text: "Name", width: name },
              ...block.items.map((a) => ({ text: headingOf(a), width: widthOf.get(a.id)! })),
              { text: "Marked", width: markedCol },
              { text: "Average", width: averageCol },
              { text: "Status", width: status },
              { text: "Signature", width: signature },
            ],
            { bold: true, shade: HEADER_SHADE }
          );
        const newPage = () => {
          header(label);
          drawHeaderRow();
        };

        if (blockIndex > 0) doc.addPage();
        newPage();

        for (const student of students) {
          const studentMarks = marksByStudent.get(student.id) ?? new Map<string, number>();
          const standing = computeStanding(
            assessments.map((a) => ({ marks: studentMarks.get(a.id) ?? null, maxMarks: a.maxMarks }))
          );
          const passed = passes(standing, settings.assessmentPassMark);

          const cells: TableCell[] = [
            { text: student.registrationNumber, width: reg },
            { text: student.fullName, width: name },
            ...block.items.map((a) => ({
              text: studentMarks.has(a.id) ? String(studentMarks.get(a.id)) : "-",
              width: widthOf.get(a.id)!,
            })),
            { text: `${standing.graded}/${standing.total}`, width: markedCol },
            { text: standing.graded > 0 ? `${standing.average.toFixed(0)}%` : "-", width: averageCol },
            // Nothing marked means no verdict to give: leave the cell empty rather
            // than printing a FAIL against work the student never sat.
            {
              text: standing.graded > 0 ? (passed ? "PASS" : "FAIL") : "",
              width: status,
              status: { positive: passed },
            },
            { text: "", width: signature },
          ];
          drawTableRow(doc, cells, { newPage });
        }
      });
    },
    { layout: "landscape", footer: { generatedAt: generatedAt() } }
  );

  return { pdf, filename: `assessments-${cls.label.replace(/\s+/g, "-")}-${dayjs().format("YYYYMMDD")}.pdf` };
}
