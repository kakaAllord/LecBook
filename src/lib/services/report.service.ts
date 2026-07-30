import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import { bufferPdf, addReportHeader, drawTableRow } from "@/lib/pdf";
import { getSettings } from "@/lib/services/settings.service";

export async function generateAttendanceReport(courseId: string, from?: string, to?: string) {
  const [course, settings] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId } }),
    getSettings(),
  ]);
  if (!course) throw new ApiError("Course not found", 404);

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = dayjs(from).startOf("day").toDate();
  if (to) dateFilter.lte = dayjs(to).endOf("day").toDate();

  const students = await prisma.student.findMany({
    where: { courseId, status: "ACTIVE" },
    orderBy: { fullName: "asc" },
    include: {
      attendance: Object.keys(dateFilter).length ? { where: { date: dateFilter } } : true,
    },
  });

  const rangeLabel =
    from && to
      ? `${dayjs(from).format("DD MMM YYYY")} - ${dayjs(to).format("DD MMM YYYY")}`
      : "All recorded dates";

  const subtitle = `${course.name} · Level ${course.level} · Semester ${course.semester} · ${course.academicYear}\nDate Range: ${rangeLabel}`;

  const colWidths = { reg: 75, name: 145, present: 45, absent: 45, late: 40, excused: 50, total: 40, pct: 55 };

  const pdf = await bufferPdf((doc) => {
    addReportHeader(doc, settings.institutionName, "Attendance Report", subtitle);

    drawTableRow(
      doc,
      [
        { text: "Reg. No", width: colWidths.reg },
        { text: "Name", width: colWidths.name },
        { text: "Present", width: colWidths.present, align: "right" },
        { text: "Absent", width: colWidths.absent, align: "right" },
        { text: "Late", width: colWidths.late, align: "right" },
        { text: "Excused", width: colWidths.excused, align: "right" },
        { text: "Total", width: colWidths.total, align: "right" },
        { text: "Attend %", width: colWidths.pct, align: "right" },
      ],
      { bold: true }
    );
    doc
      .strokeColor("#dddddd")
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .stroke();
    doc.moveDown(0.3);

    for (const student of students) {
      const present = student.attendance.filter((a) => a.status === "PRESENT").length;
      const absent = student.attendance.filter((a) => a.status === "ABSENT").length;
      const late = student.attendance.filter((a) => a.status === "LATE").length;
      const excused = student.attendance.filter((a) => a.status === "EXCUSED").length;
      const total = student.attendance.length;
      const pct = total > 0 ? ((present / total) * 100).toFixed(1) : "0.0";

      if (doc.y > doc.page.height - doc.page.margins.bottom - 40) {
        doc.addPage();
      }

      drawTableRow(doc, [
        { text: student.registrationNumber, width: colWidths.reg },
        { text: student.fullName, width: colWidths.name },
        { text: String(present), width: colWidths.present, align: "right" },
        { text: String(absent), width: colWidths.absent, align: "right" },
        { text: String(late), width: colWidths.late, align: "right" },
        { text: String(excused), width: colWidths.excused, align: "right" },
        { text: String(total), width: colWidths.total, align: "right" },
        { text: `${pct}%`, width: colWidths.pct, align: "right" },
      ]);
    }

    if (students.length === 0) {
      doc.font("Helvetica").fontSize(10).text("No active students found for this course.");
    }

    doc.moveDown(1);
    doc
      .fontSize(8)
      .fillColor("#888888")
      .text(`Generated on ${dayjs().format("DD MMM YYYY, HH:mm")}`, { align: "right" });
  });

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

  const colWidths = { reg: 90, name: 210, marks: 90, remarks: 125 };

  const pdf = await bufferPdf((doc) => {
    addReportHeader(doc, settings.institutionName, "Assessment Report", subtitle);

    doc.font("Helvetica-Bold").fontSize(10);
    doc.text(
      `Max Marks: ${assessment.assessmentType.maxMarks}    Total Students: ${total}    Average: ${average.toFixed(1)}    Highest: ${highest}    Lowest: ${lowest}`
    );
    doc.moveDown(0.8);

    drawTableRow(
      doc,
      [
        { text: "Reg. No", width: colWidths.reg },
        { text: "Name", width: colWidths.name },
        { text: `Marks (/${assessment.assessmentType.maxMarks})`, width: colWidths.marks, align: "right" },
        { text: "Remarks", width: colWidths.remarks },
      ],
      { bold: true }
    );
    doc
      .strokeColor("#dddddd")
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .stroke();
    doc.moveDown(0.3);

    for (const mark of marks) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 40) {
        doc.addPage();
      }
      drawTableRow(doc, [
        { text: mark.student.registrationNumber, width: colWidths.reg },
        { text: mark.student.fullName, width: colWidths.name },
        { text: String(mark.marks), width: colWidths.marks, align: "right" },
        { text: mark.remarks || "-", width: colWidths.remarks },
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
