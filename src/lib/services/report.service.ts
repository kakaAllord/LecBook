import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import { bufferPdf, addReportHeader, drawTableRow, drawTick } from "@/lib/pdf";
import { getSettings } from "@/lib/services/settings.service";

const REG_COL_WIDTH = 65;
const NAME_COL_WIDTH = 135;
const PRESENT_COL_WIDTH = 42;
const PCT_COL_WIDTH = 40;
const DATE_COL_WIDTH = 24;
const ROW_HEIGHT = 16;
const ASSESSMENT_COL_WIDTH = 55;
const SIGNATURE_COL_WIDTH = 90;

export async function generateAttendanceReport(courseId: string, from?: string, to?: string) {
  const [course, settings] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId } }),
    getSettings(),
  ]);
  if (!course) throw new ApiError("Course not found", 404);

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = dayjs(from).startOf("day").toDate();
  if (to) dateFilter.lte = dayjs(to).endOf("day").toDate();

  const [students, records] = await Promise.all([
    prisma.student.findMany({
      where: { courseId, status: "ACTIVE" },
      orderBy: { fullName: "asc" },
    }),
    prisma.attendance.findMany({
      where: {
        student: { courseId },
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

  const subtitle = `${course.name} · Level ${course.level} · Semester ${course.semester} · ${course.academicYear}\nDate Range: ${rangeLabel}`;

  const pdf = await bufferPdf(
    (doc) => {
      if (students.length === 0 || dates.length === 0) {
        addReportHeader(doc, settings.institutionName, "Attendance Register", subtitle, settings.institutionLogo);
        doc
          .font("Helvetica")
          .fontSize(10)
          .text(
            students.length === 0
              ? "No active students found for this course."
              : "No attendance has been recorded for this course yet."
          );
        return;
      }

      const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const fixedWidth = REG_COL_WIDTH + NAME_COL_WIDTH + PRESENT_COL_WIDTH + PCT_COL_WIDTH;
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
          ],
          { bold: true, fontSize: 7.5 }
        );
        doc
          .strokeColor("#dddddd")
          .moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .stroke();
        doc.moveDown(0.3);
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
          const pct = ((totalPresent / dates.length) * 100).toFixed(0);

          const rowY = doc.y;
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

  return { pdf, filename: `attendance-${course.name}-${dayjs().format("YYYYMMDD")}.pdf` };
}

export async function generateAssessmentReport(assessmentId: string) {
  const [assessment, settings] = await Promise.all([
    prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { course: true, assessmentType: true },
    }),
    getSettings(),
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
  const highest = total > 0 ? Math.max(...values) : 0;
  const lowest = total > 0 ? Math.min(...values) : 0;

  const subtitle = `${assessment.course.name} · Level ${assessment.course.level} · ${assessment.course.academicYear}\n${assessment.assessmentType.name}: ${assessment.title} · ${dayjs(assessment.date).format("DD MMM YYYY")}`;

  const colWidths = { reg: 70, name: 150, marks: 65, remarks: 85, signature: 95 };

  const drawHeaderRow = (doc: PDFKit.PDFDocument) => {
    drawTableRow(
      doc,
      [
        { text: "Reg. No", width: colWidths.reg },
        { text: "Name", width: colWidths.name },
        { text: `Marks (/${assessment.assessmentType.maxMarks})`, width: colWidths.marks, align: "right" },
        { text: "Remarks", width: colWidths.remarks },
        { text: "Signature", width: colWidths.signature },
      ],
      { bold: true }
    );
    doc
      .strokeColor("#dddddd")
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .stroke();
    doc.moveDown(0.3);
  };

  const pdf = await bufferPdf((doc) => {
    addReportHeader(doc, settings.institutionName, "Assessment Report", subtitle, settings.institutionLogo);

    doc.font("Helvetica-Bold").fontSize(10);
    doc.text(
      `Max Marks: ${assessment.assessmentType.maxMarks}    Total Students: ${total}    Average: ${average.toFixed(1)}    Highest: ${highest}    Lowest: ${lowest}`
    );
    doc.moveDown(0.8);

    drawHeaderRow(doc);

    for (const mark of marks) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 40) {
        doc.addPage();
        addReportHeader(doc, settings.institutionName, "Assessment Report", subtitle, settings.institutionLogo);
        drawHeaderRow(doc);
      }
      drawTableRow(doc, [
        { text: mark.student.registrationNumber, width: colWidths.reg },
        { text: mark.student.fullName, width: colWidths.name, ellipsis: true },
        { text: String(mark.marks), width: colWidths.marks, align: "right" },
        { text: mark.remarks || "-", width: colWidths.remarks, ellipsis: true },
        { text: "", width: colWidths.signature },
      ]);
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
    filename: `assessment-${assessment.title.replace(/\s+/g, "-")}-${dayjs().format("YYYYMMDD")}.pdf`,
  };
}

export async function generateAllAssessmentsReport(courseId: string) {
  const [course, settings] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId } }),
    getSettings(),
  ]);
  if (!course) throw new ApiError("Course not found", 404);

  const [students, assessments] = await Promise.all([
    prisma.student.findMany({
      where: { courseId, status: "ACTIVE" },
      orderBy: { fullName: "asc" },
    }),
    prisma.assessment.findMany({
      where: { courseId },
      include: { assessmentType: true },
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

  const totalPossible = assessments.reduce((sum, a) => sum + a.assessmentType.maxMarks, 0);

  const subtitle = `${course.name} · Level ${course.level} · Semester ${course.semester} · ${course.academicYear}\nAll Assessments (${assessments.length})`;

  const pdf = await bufferPdf(
    (doc) => {
      if (students.length === 0 || assessments.length === 0) {
        addReportHeader(doc, settings.institutionName, "Assessment Summary", subtitle, settings.institutionLogo);
        doc
          .font("Helvetica")
          .fontSize(10)
          .text(
            students.length === 0
              ? "No active students found for this course."
              : "No assessments have been recorded for this course yet."
          );
        return;
      }

      const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const fixedWidth = REG_COL_WIDTH + NAME_COL_WIDTH + PRESENT_COL_WIDTH + PCT_COL_WIDTH + SIGNATURE_COL_WIDTH;
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
              text: a.title,
              width: ASSESSMENT_COL_WIDTH,
              align: "right" as const,
              ellipsis: true,
            })),
            { text: "Total", width: PRESENT_COL_WIDTH, align: "right" as const },
            { text: "Score %", width: PCT_COL_WIDTH, align: "right" as const },
            { text: "Signature", width: SIGNATURE_COL_WIDTH },
          ],
          { bold: true, fontSize: 7.5 }
        );
        doc
          .strokeColor("#dddddd")
          .moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .stroke();
        doc.moveDown(0.3);
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
          const totalObtained = assessments.reduce((sum, a) => sum + (studentMarks.get(a.id) ?? 0), 0);
          const pct = totalPossible > 0 ? ((totalObtained / totalPossible) * 100).toFixed(0) : "0";

          drawTableRow(doc, [
            { text: student.registrationNumber, width: REG_COL_WIDTH },
            { text: student.fullName, width: NAME_COL_WIDTH, ellipsis: true },
            ...chunk.map((a) => ({
              text: studentMarks.has(a.id) ? String(studentMarks.get(a.id)) : "-",
              width: ASSESSMENT_COL_WIDTH,
              align: "right" as const,
            })),
            { text: totalObtained.toFixed(1), width: PRESENT_COL_WIDTH, align: "right" as const },
            { text: `${pct}%`, width: PCT_COL_WIDTH, align: "right" as const },
            { text: "", width: SIGNATURE_COL_WIDTH },
          ]);
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

  return { pdf, filename: `assessments-${course.name}-${dayjs().format("YYYYMMDD")}.pdf` };
}
