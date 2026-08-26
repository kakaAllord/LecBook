import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import { bufferPdf, addReportHeader, drawTableRow, drawTick, drawStatusCell, drawRowGrid } from "@/lib/pdf";
import { toUtcDayStart, toUtcDayEnd } from "@/lib/date";
import { computeStanding, passes, roundPercentage, scorePercentage } from "@/lib/grading";
import { getSettingsFor } from "@/lib/services/settings.service";
import type { Session } from "@/lib/auth";

const REG_COL_WIDTH = 65;
const NAME_COL_WIDTH = 135;
const PRESENT_COL_WIDTH = 42;
const PCT_COL_WIDTH = 40;
const DATE_COL_WIDTH = 24;
const ROW_HEIGHT = 16;
const ASSESSMENT_COL_WIDTH = 55;
const SIGNATURE_COL_WIDTH = 90;
const STATUS_COL_WIDTH = 48;

async function resolveModuleScope(moduleId: string, courseId?: string) {
  const module_ = await prisma.module.findUnique({ where: { id: moduleId }, include: { courses: true } });
  if (!module_) throw new ApiError("Module not found", 404);

  if (courseId) {
    const course = module_.courses.find((c) => c.id === courseId);
    if (!course) throw new ApiError("Course is not linked to this module", 422);
    return { module: module_, scopeCourses: [course] };
  }
  return { module: module_, scopeCourses: module_.courses };
}

function courseScopeLabel(scopeCourses: { name: string }[], allCourseCount: number) {
  if (scopeCourses.length === 1) return scopeCourses[0].name;
  if (scopeCourses.length === allCourseCount) return "All Courses";
  return scopeCourses.map((c) => c.name).join(", ");
}

export async function generateAttendanceReport(
  session: Session,
  moduleId: string,
  courseId?: string,
  from?: string,
  to?: string
) {
  const [{ module: module_, scopeCourses }, settings] = await Promise.all([
    resolveModuleScope(moduleId, courseId),
    getSettingsFor(session),
  ]);

  const scopeCourseIds = scopeCourses.map((c) => c.id);

  const dateFilter: { gte?: Date; lte?: Date } = {};
  const fromDay = from ? toUtcDayStart(from) : null;
  const toDay = to ? toUtcDayEnd(to) : null;
  if (fromDay) dateFilter.gte = fromDay;
  if (toDay) dateFilter.lte = toDay;

  const [students, records] = await Promise.all([
    prisma.student.findMany({
      where: { courseId: { in: scopeCourseIds }, status: "ACTIVE" },
      orderBy: { fullName: "asc" },
    }),
    prisma.attendance.findMany({
      where: {
        moduleId,
        student: { courseId: { in: scopeCourseIds } },
        ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
      },
      orderBy: { date: "asc" },
    }),
  ]);

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

  const subtitle = `${module_.name}${module_.code ? ` (${module_.code})` : ""} · ${courseScopeLabel(scopeCourses, module_.courses.length)}\nDate Range: ${rangeLabel}`;

  const pdf = await bufferPdf(
    (doc) => {
      if (students.length === 0 || dates.length === 0) {
        addReportHeader(doc, settings.institutionName, "Attendance Register", subtitle, settings.institutionLogo);
        doc
          .font("Helvetica")
          .fontSize(10)
          .text(
            students.length === 0
              ? "No active students found for this scope."
              : "No attendance has been recorded for this module yet."
          );
        return;
      }

      const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const fixedWidth =
        REG_COL_WIDTH +
        NAME_COL_WIDTH +
        PRESENT_COL_WIDTH +
        PCT_COL_WIDTH +
        STATUS_COL_WIDTH +
        SIGNATURE_COL_WIDTH;
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
            ...chunk.map((d) => ({ text: dayjs(d).format("DD/MM"), width: DATE_COL_WIDTH, align: "center" as const })),
            { text: "Pres.", width: PRESENT_COL_WIDTH, align: "right" as const },
            { text: "Att %", width: PCT_COL_WIDTH, align: "right" as const },
            { text: "Status", width: STATUS_COL_WIDTH, align: "center" as const },
            { text: "Signature", width: SIGNATURE_COL_WIDTH },
          ],
          { bold: true, fontSize: 7.5, rowHeight: ROW_HEIGHT }
        );
      };

      const pageLabel = (chunkIndex: number) =>
        chunks.length > 1 ? `${subtitle} · Page ${chunkIndex + 1} of ${chunks.length}` : subtitle;

      chunks.forEach((chunk, chunkIndex) => {
        if (chunkIndex > 0) doc.addPage();
        addReportHeader(
          doc,
          settings.institutionName,
          "Attendance Register",
          pageLabel(chunkIndex),
          settings.institutionLogo
        );
        drawHeaderRow(chunk);

        for (const student of students) {
          if (doc.y > doc.page.height - doc.page.margins.bottom - ROW_HEIGHT) {
            doc.addPage();
            addReportHeader(
              doc,
              settings.institutionName,
              "Attendance Register",
              pageLabel(chunkIndex),
              settings.institutionLogo
            );
            drawHeaderRow(chunk);
          }

          const presentDates = presentDatesByStudent.get(student.id) ?? new Set<string>();
          const totalPresent = presentDatesByStudent.get(student.id)?.size ?? 0;
          const pctValue = (totalPresent / dates.length) * 100;
          const pct = pctValue.toFixed(0);
          const meetsThreshold = pctValue >= settings.attendanceThreshold;

          const rowY = doc.y;
          drawRowGrid(
            doc,
            doc.page.margins.left,
            rowY,
            [
              REG_COL_WIDTH,
              NAME_COL_WIDTH,
              ...chunk.map(() => DATE_COL_WIDTH),
              PRESENT_COL_WIDTH,
              PCT_COL_WIDTH,
              STATUS_COL_WIDTH,
              SIGNATURE_COL_WIDTH,
            ],
            ROW_HEIGHT
          );
          doc.font("Helvetica").fontSize(8);
          let x = doc.page.margins.left;
          doc.text(student.registrationNumber, x, rowY, { width: REG_COL_WIDTH });
          x += REG_COL_WIDTH;
          doc.text(student.fullName, x, rowY, { width: NAME_COL_WIDTH, ellipsis: true });
          x += NAME_COL_WIDTH;

          for (const d of chunk) {
            if (presentDates.has(d)) {
              drawTick(doc, x + DATE_COL_WIDTH / 2 - 4, rowY + 1, 8);
            }
            x += DATE_COL_WIDTH;
          }

          doc.text(String(totalPresent), x, rowY, { width: PRESENT_COL_WIDTH, align: "right" });
          x += PRESENT_COL_WIDTH;
          doc.text(`${pct}%`, x, rowY, { width: PCT_COL_WIDTH, align: "right" });
          x += PCT_COL_WIDTH;
          drawStatusCell(doc, x, rowY, STATUS_COL_WIDTH, ROW_HEIGHT, meetsThreshold ? "OK" : "LOW", meetsThreshold);
          // Signature column intentionally left blank for physical sign-off.

          doc.y = rowY + ROW_HEIGHT;
        }
      });

      doc.moveDown(1);
      doc
        .fontSize(8)
        .fillColor("#888888")
        .text(`Generated on ${dayjs().format("DD MMM YYYY, HH:mm")}`, { align: "right" });
    },
    { layout: "landscape" }
  );

  return { pdf, filename: `attendance-${module_.name.replace(/\s+/g, "-")}-${dayjs().format("YYYYMMDD")}.pdf` };
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
  const subtitle = `${assessment.module.name} · ${courseLabel}\n${assessment.name} · ${dayjs(assessment.date).format("DD MMM YYYY")}`;

  // The sheet carries a percentage and a verdict as well as the raw mark: the
  // mark on its own says nothing now that every assessment sets its own total,
  // and the pass mark it is judged against is a percentage. The widths add up
  // to the usable page width, Reg. No wide enough for a full registration
  // number on one line at this font size.
  const colWidths = { reg: 82, name: 118, marks: 52, pct: 40, status: 44, remarks: 84, signature: 95 };

  const HEADER_ROW_HEIGHT = 16;
  const ROW_FONT_SIZE = 8;
  const STATUS_COL_X = colWidths.reg + colWidths.name + colWidths.marks + colWidths.pct;

  const drawHeaderRow = (doc: PDFKit.PDFDocument) => {
    drawTableRow(
      doc,
      [
        { text: "Reg. No", width: colWidths.reg },
        { text: "Name", width: colWidths.name },
        { text: `Marks /${assessment.maxMarks}`, width: colWidths.marks, align: "right" },
        { text: "Score", width: colWidths.pct, align: "right" },
        { text: "Status", width: colWidths.status, align: "center" },
        { text: "Remarks", width: colWidths.remarks },
        { text: "Signature", width: colWidths.signature },
      ],
      { bold: true, fontSize: ROW_FONT_SIZE, rowHeight: HEADER_ROW_HEIGHT }
    );
  };

  const pdf = await bufferPdf((doc) => {
    addReportHeader(doc, settings.institutionName, "Assessment Report", subtitle, settings.institutionLogo);

    doc.font("Helvetica-Bold").fontSize(10);
    doc.text(
      `Marked out of: ${assessment.maxMarks}    Total Students: ${total}    Average: ${average.toFixed(1)} (${averagePct}%)    Highest: ${highest}    Lowest: ${lowest}`
    );
    doc.font("Helvetica").fontSize(9).fillColor("#555555");
    doc.text(`Score is the mark as a percentage of ${assessment.maxMarks}. PASS is ${settings.assessmentPassMark}% or above.`);
    doc.fillColor("#000000");
    doc.moveDown(0.8);

    drawHeaderRow(doc);

    for (const mark of marks) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 40) {
        doc.addPage();
        addReportHeader(doc, settings.institutionName, "Assessment Report", subtitle, settings.institutionLogo);
        drawHeaderRow(doc);
      }
      // Judged on the rounded figure, so the verdict never contradicts the
      // percentage printed beside it on a sheet somebody is asked to sign.
      const percentage = roundPercentage(scorePercentage(mark.marks, assessment.maxMarks));
      const passed = percentage >= settings.assessmentPassMark;
      const rowY = doc.y;
      drawTableRow(
        doc,
        [
          { text: mark.student.registrationNumber, width: colWidths.reg },
          { text: mark.student.fullName, width: colWidths.name, ellipsis: true },
          { text: String(mark.marks), width: colWidths.marks, align: "right" },
          { text: `${percentage}%`, width: colWidths.pct, align: "right" },
          { text: "", width: colWidths.status },
          { text: mark.remarks || "-", width: colWidths.remarks, ellipsis: true },
          { text: "", width: colWidths.signature },
        ],
        { fontSize: ROW_FONT_SIZE, rowHeight: HEADER_ROW_HEIGHT }
      );
      // Painted over the cell drawTableRow left empty, so the verdict reads in
      // the same green/red as it does on the summary sheet.
      drawStatusCell(
        doc,
        doc.page.margins.left + STATUS_COL_X,
        rowY + 4,
        colWidths.status,
        HEADER_ROW_HEIGHT,
        passed ? "PASS" : "REDO",
        passed
      );
      // drawStatusCell writes at an absolute position and pdfkit advances doc.y
      // past it, which would start the next row short of a full row height.
      doc.y = rowY + HEADER_ROW_HEIGHT;
    }

    if (marks.length === 0) {
      doc.font("Helvetica").fontSize(10).text("No marks recorded for this assessment yet.");
    }

    doc.moveDown(1);
    doc
      .fontSize(8)
      .fillColor("#888888")
      .text(`Generated on ${dayjs().format("DD MMM YYYY, HH:mm")}`, { align: "right" });
  });

  return {
    pdf,
    filename: `assessment-${assessment.name.replace(/\s+/g, "-")}-${dayjs().format("YYYYMMDD")}.pdf`,
  };
}

export async function generateAllAssessmentsReport(session: Session, moduleId: string, courseId?: string) {
  const [{ module: module_, scopeCourses }, settings] = await Promise.all([
    resolveModuleScope(moduleId, courseId),
    getSettingsFor(session),
  ]);
  const scopeCourseIds = scopeCourses.map((c) => c.id);

  const [students, assessments] = await Promise.all([
    prisma.student.findMany({
      where: { courseId: { in: scopeCourseIds }, status: "ACTIVE" },
      orderBy: { fullName: "asc" },
    }),
    prisma.assessment.findMany({
      where: {
        moduleId,
        ...(courseId ? { courses: { some: { id: courseId } } } : {}),
      },
      orderBy: { date: "asc" },
    }),
  ]);

  const assessmentIds = assessments.map((a) => a.id);
  const marks = assessmentIds.length
    ? await prisma.assessmentMark.findMany({ where: { assessmentId: { in: assessmentIds } } })
    : [];

  const marksByStudent = new Map<string, Map<string, number>>();
  for (const m of marks) {
    if (!marksByStudent.has(m.studentId)) marksByStudent.set(m.studentId, new Map());
    marksByStudent.get(m.studentId)!.set(m.assessmentId, m.marks);
  }

  const subtitle = `${module_.name}${module_.code ? ` (${module_.code})` : ""} · ${courseScopeLabel(scopeCourses, module_.courses.length)}\nAll Assessments (${assessments.length}) · Average of each assessment's score, pass mark ${settings.assessmentPassMark}%`;

  const pdf = await bufferPdf(
    (doc) => {
      if (students.length === 0 || assessments.length === 0) {
        addReportHeader(doc, settings.institutionName, "Assessment Summary", subtitle, settings.institutionLogo);
        doc
          .font("Helvetica")
          .fontSize(10)
          .text(
            students.length === 0
              ? "No active students found for this scope."
              : "No assessments have been recorded for this module yet."
          );
        return;
      }

      const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const fixedWidth =
        REG_COL_WIDTH + NAME_COL_WIDTH + PRESENT_COL_WIDTH + PCT_COL_WIDTH + STATUS_COL_WIDTH + SIGNATURE_COL_WIDTH;
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
            ...chunk.map((a) => ({
              text: `${a.name} /${a.maxMarks}`,
              width: ASSESSMENT_COL_WIDTH,
              align: "right" as const,
              ellipsis: true,
            })),
            { text: "Marked", width: PRESENT_COL_WIDTH, align: "right" as const },
            { text: "Average", width: PCT_COL_WIDTH, align: "right" as const },
            { text: "Status", width: STATUS_COL_WIDTH, align: "center" as const },
            { text: "Signature", width: SIGNATURE_COL_WIDTH },
          ],
          { bold: true, fontSize: 7.5, rowHeight: ROW_HEIGHT }
        );
      };

      const pageLabel = (chunkIndex: number) =>
        chunks.length > 1 ? `${subtitle} · Page ${chunkIndex + 1} of ${chunks.length}` : subtitle;

      chunks.forEach((chunk, chunkIndex) => {
        if (chunkIndex > 0) doc.addPage();
        addReportHeader(
          doc,
          settings.institutionName,
          "Assessment Summary",
          pageLabel(chunkIndex),
          settings.institutionLogo
        );
        drawHeaderRow(chunk);

        for (const student of students) {
          if (doc.y > doc.page.height - doc.page.margins.bottom - ROW_HEIGHT) {
            doc.addPage();
            addReportHeader(
              doc,
              settings.institutionName,
              "Assessment Summary",
              pageLabel(chunkIndex),
              settings.institutionLogo
            );
            drawHeaderRow(chunk);
          }

          const studentMarks = marksByStudent.get(student.id) ?? new Map<string, number>();
          const standing = computeStanding(
            assessments.map((a) => ({ marks: studentMarks.get(a.id) ?? null, maxMarks: a.maxMarks }))
          );
          const passed = passes(standing, settings.assessmentPassMark);

          const rowY = doc.y;
          drawRowGrid(
            doc,
            doc.page.margins.left,
            rowY,
            [
              REG_COL_WIDTH,
              NAME_COL_WIDTH,
              ...chunk.map(() => ASSESSMENT_COL_WIDTH),
              PRESENT_COL_WIDTH,
              PCT_COL_WIDTH,
              STATUS_COL_WIDTH,
              SIGNATURE_COL_WIDTH,
            ],
            ROW_HEIGHT
          );
          doc.font("Helvetica").fontSize(8);
          let x = doc.page.margins.left;
          doc.text(student.registrationNumber, x, rowY, { width: REG_COL_WIDTH - 4 });
          x += REG_COL_WIDTH;
          doc.text(student.fullName, x, rowY, { width: NAME_COL_WIDTH - 4, ellipsis: true });
          x += NAME_COL_WIDTH;

          for (const a of chunk) {
            const value = studentMarks.has(a.id) ? String(studentMarks.get(a.id)) : "-";
            doc.text(value, x, rowY, { width: ASSESSMENT_COL_WIDTH - 4, align: "right" });
            x += ASSESSMENT_COL_WIDTH;
          }

          doc.text(`${standing.graded}/${standing.total}`, x, rowY, {
            width: PRESENT_COL_WIDTH - 4,
            align: "right",
          });
          x += PRESENT_COL_WIDTH;
          doc.text(standing.graded > 0 ? `${standing.average.toFixed(0)}%` : "-", x, rowY, {
            width: PCT_COL_WIDTH - 4,
            align: "right",
          });
          x += PCT_COL_WIDTH;
          // Nothing marked means no verdict to give: leave the cell empty rather
          // than printing a REDO against work the student never sat.
          if (standing.graded > 0) {
            drawStatusCell(doc, x, rowY, STATUS_COL_WIDTH, ROW_HEIGHT, passed ? "PASS" : "REDO", passed);
          }
          x += STATUS_COL_WIDTH;
          // Signature column intentionally left blank for physical sign-off.

          doc.y = rowY + ROW_HEIGHT;
        }
      });

      doc.moveDown(1);
      doc
        .fontSize(8)
        .fillColor("#888888")
        .text(`Generated on ${dayjs().format("DD MMM YYYY, HH:mm")}`, { align: "right" });
    },
    { layout: "landscape" }
  );

  return { pdf, filename: `assessments-${module_.name.replace(/\s+/g, "-")}-${dayjs().format("YYYYMMDD")}.pdf` };
}
