import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import { bufferPdf, addReportHeader, drawTableRow } from "@/lib/pdf";
import { computeStanding, passes, roundPercentage } from "@/lib/grading";
import { getSettingsFor } from "@/lib/services/settings.service";
import type { Session } from "@/lib/auth";
import { toUtcDayStart, toUtcDayEnd } from "@/lib/date";
import type { StudentExportInput } from "@/lib/validators/export";

export type StudentExportData = {
  generatedAt: string;
  institutionName: string;
  student: {
    registrationNumber: string;
    fullName: string;
    gender: string;
    phone: string | null;
    status: string;
    course: string;
    level: string;
    semester: string;
    academicYear: string;
    registeredOn: string;
  };
  filters: {
    attendanceRange: string;
    attendanceModules: string;
    assessmentModules: string;
    assessments: string;
  };
  attendance?: {
    modules: {
      module: string;
      present: number;
      absent: number;
      total: number;
      percentage: number;
      meetsThreshold: boolean;
      records?: { date: string; status: string; remarks: string | null }[];
    }[];
    overall: { present: number; absent: number; total: number; percentage: number };
  };
  assessments?: {
    modules: {
      module: string;
      items: { name: string; date: string; marks: number | null; maxMarks: number; remarks: string | null }[];
      /** Mean of the percentages scored on the assessments that carry a mark. */
      average: number;
      graded: number;
      total: number;
      /** False while nothing in the module is marked, so no verdict is shown. */
      passes: boolean;
    }[];
    overall: {
      average: number;
      /** Zero when nothing has been marked, so no verdict is shown. */
      graded: number;
      total: number;
      passes: boolean;
    };
  };
  thresholds: { attendance: number; passMark: number };
};

function pct(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

/**
 * Collects one student's record according to the chosen filters. Returns plain
 * data so the same result can be rendered as a PDF or copied as text.
 */
export async function buildStudentExport(
  session: Session,
  studentId: string,
  options: StudentExportInput
): Promise<StudentExportData> {
  const [student, settings] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, include: { course: true } }),
    getSettingsFor(session),
  ]);
  if (!student) throw new ApiError("Student not found", 404);

  const attendanceModuleIds = options.attendanceModuleIds ?? [];
  const assessmentModuleIds = options.assessmentModuleIds ?? [];
  const assessmentIds = options.assessmentIds ?? [];

  const from = options.attendanceFrom ? toUtcDayStart(options.attendanceFrom) ?? undefined : undefined;
  const to = options.attendanceTo ? toUtcDayEnd(options.attendanceTo) ?? undefined : undefined;

  const data: StudentExportData = {
    generatedAt: dayjs().format("DD MMM YYYY, HH:mm"),
    institutionName: settings.institutionName,
    student: {
      registrationNumber: student.registrationNumber,
      fullName: student.fullName,
      gender: student.gender,
      phone: student.phone,
      status: student.status,
      course: student.course.name,
      level: student.course.level,
      semester: student.course.semester,
      academicYear: student.course.academicYear,
      registeredOn: dayjs(student.createdAt).format("DD MMM YYYY"),
    },
    filters: {
      attendanceRange:
        from || to
          ? `${from ? dayjs(from).format("DD MMM YYYY") : "start"} to ${to ? dayjs(to).format("DD MMM YYYY") : "today"}`
          : "All recorded dates",
      attendanceModules: attendanceModuleIds.length > 0 ? `${attendanceModuleIds.length} selected` : "All modules",
      assessmentModules: assessmentModuleIds.length > 0 ? `${assessmentModuleIds.length} selected` : "All modules",
      assessments: assessmentIds.length > 0 ? `${assessmentIds.length} selected` : "All assessments",
    },
    thresholds: { attendance: settings.attendanceThreshold, passMark: settings.assessmentPassMark },
  };

  if (options.includeAttendance) {
    const records = await prisma.attendance.findMany({
      where: {
        studentId,
        ...(attendanceModuleIds.length > 0 ? { moduleId: { in: attendanceModuleIds } } : {}),
        ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      include: { module: true },
      orderBy: [{ module: { name: "asc" } }, { date: "asc" }],
    });

    const byModule = new Map<string, typeof records>();
    for (const record of records) {
      const key = record.module.code ? `${record.module.name} (${record.module.code})` : record.module.name;
      if (!byModule.has(key)) byModule.set(key, []);
      byModule.get(key)!.push(record);
    }

    const modules = Array.from(byModule.entries()).map(([module, rows]) => {
      const present = rows.filter((r) => r.status === "PRESENT").length;
      const percentage = pct(present, rows.length);
      return {
        module,
        present,
        absent: rows.length - present,
        total: rows.length,
        percentage,
        meetsThreshold: percentage >= settings.attendanceThreshold,
        ...(options.attendanceDetail === "full"
          ? {
              records: rows.map((r) => ({
                date: dayjs(r.date).format("DD MMM YYYY"),
                status: r.status,
                remarks: r.remarks,
              })),
            }
          : {}),
      };
    });

    const present = records.filter((r) => r.status === "PRESENT").length;
    data.attendance = {
      modules,
      overall: {
        present,
        absent: records.length - present,
        total: records.length,
        percentage: pct(present, records.length),
      },
    };
  }

  if (options.includeAssessments) {
    // Every assessment the student is eligible for through their course, so a
    // missing mark can be shown as a gap rather than silently omitted.
    const assessments = await prisma.assessment.findMany({
      where: {
        courses: { some: { id: student.courseId } },
        ...(assessmentModuleIds.length > 0 ? { moduleId: { in: assessmentModuleIds } } : {}),
        ...(assessmentIds.length > 0 ? { id: { in: assessmentIds } } : {}),
      },
      include: { module: true, marks: { where: { studentId } } },
      orderBy: [{ module: { name: "asc" } }, { date: "asc" }],
    });

    const byModule = new Map<string, typeof assessments>();
    for (const assessment of assessments) {
      const mark = assessment.marks[0];
      if (!mark && !options.includeMissingMarks) continue;
      const key = assessment.module.code
        ? `${assessment.module.name} (${assessment.module.code})`
        : assessment.module.name;
      if (!byModule.has(key)) byModule.set(key, []);
      byModule.get(key)!.push(assessment);
    }

    const scoreOf = (a: (typeof assessments)[number]) => ({
      marks: a.marks[0]?.marks ?? null,
      maxMarks: a.maxMarks,
    });

    const modules = Array.from(byModule.entries()).map(([module, items]) => {
      const standing = computeStanding(items.map(scoreOf));
      return {
        module,
        items: items.map((a) => ({
          name: a.name,
          date: dayjs(a.date).format("DD MMM YYYY"),
          marks: a.marks[0]?.marks ?? null,
          maxMarks: a.maxMarks,
          remarks: a.marks[0]?.remarks ?? null,
        })),
        average: roundPercentage(standing.average),
        graded: standing.graded,
        total: standing.total,
        passes: passes(standing, settings.assessmentPassMark),
      };
    });

    // Averaged across every assessment in scope rather than across the module
    // averages, so a module with more assessments carries proportionate weight.
    const overall = computeStanding(Array.from(byModule.values()).flat().map(scoreOf));
    data.assessments = {
      modules,
      overall: {
        average: roundPercentage(overall.average),
        graded: overall.graded,
        total: overall.total,
        passes: passes(overall, settings.assessmentPassMark),
      },
    };
  }

  return data;
}

/** Plain-text rendering, for pasting a student's record into an email or message. */
export function renderStudentExportText(data: StudentExportData, options: StudentExportInput) {
  const lines: string[] = [];
  const rule = "=".repeat(60);

  lines.push(rule, `${data.institutionName} — Student Record`, rule, "");

  if (options.includeProfile) {
    lines.push("STUDENT DETAILS");
    lines.push(`  Name:            ${data.student.fullName}`);
    lines.push(`  Reg. No:         ${data.student.registrationNumber}`);
    lines.push(`  Gender:          ${data.student.gender}`);
    lines.push(`  Phone:           ${data.student.phone || "-"}`);
    lines.push(`  Course:          ${data.student.course}`);
    lines.push(`  Level/Semester:  ${data.student.level} · ${data.student.semester}`);
    lines.push(`  Academic Year:   ${data.student.academicYear}`);
    lines.push(`  Status:          ${data.student.status}`);
    lines.push(`  Registered:      ${data.student.registeredOn}`);
    lines.push("");
  }

  if (data.attendance) {
    lines.push("ATTENDANCE", `  Range: ${data.filters.attendanceRange}`, "");
    for (const m of data.attendance.modules) {
      lines.push(
        `  ${m.module}: ${m.present}/${m.total} present (${m.percentage}%) — ${m.meetsThreshold ? "OK" : "BELOW THRESHOLD"}`
      );
      if (m.records) {
        for (const r of m.records) {
          lines.push(`      ${r.date}  ${r.status}${r.remarks ? `  — ${r.remarks}` : ""}`);
        }
      }
    }
    if (data.attendance.modules.length === 0) lines.push("  No attendance recorded for this selection.");
    lines.push(
      "",
      `  OVERALL: ${data.attendance.overall.present}/${data.attendance.overall.total} (${data.attendance.overall.percentage}%)`,
      ""
    );
  }

  if (data.assessments) {
    lines.push("ASSESSMENTS", "");
    for (const m of data.assessments.modules) {
      lines.push(
        m.graded > 0
          ? `  ${m.module} — average ${m.average}% over ${m.graded} of ${m.total} assessment${m.total === 1 ? "" : "s"} — ${m.passes ? "PASS" : "REDO"}`
          : `  ${m.module} — nothing marked yet`
      );
      for (const item of m.items) {
        const score = item.marks === null ? "not marked" : `${item.marks}/${item.maxMarks}`;
        lines.push(`      ${item.name} (${item.date}): ${score}${item.remarks ? ` — ${item.remarks}` : ""}`);
      }
    }
    if (data.assessments.modules.length === 0) lines.push("  No assessments recorded for this selection.");
    lines.push(
      "",
      data.assessments.overall.graded > 0
        ? `  OVERALL: average ${data.assessments.overall.average}% over ${data.assessments.overall.graded} of ${data.assessments.overall.total} assessments — ${data.assessments.overall.passes ? "PASS" : "REDO"}`
        : "  OVERALL: nothing marked yet",
      ""
    );
  }

  if (options.includeSummary) {
    lines.push("SUMMARY");
    if (data.attendance) {
      lines.push(
        `  Attendance ${data.attendance.overall.percentage}% (threshold ${data.thresholds.attendance}%)`
      );
    }
    if (data.assessments) {
      lines.push(
        data.assessments.overall.graded > 0
          ? `  Assessment average ${data.assessments.overall.average}% (pass mark ${data.thresholds.passMark}%)`
          : "  Assessment: none marked for this selection"
      );
    }
    lines.push("");
  }

  lines.push(rule, `Generated ${data.generatedAt}`);
  return lines.join("\n");
}

const COL = { label: 150, value: 300 };

export async function renderStudentExportPdf(data: StudentExportData, options: StudentExportInput) {
  const pdf = await bufferPdf((doc) => {
    addReportHeader(
      doc,
      data.institutionName,
      "Student Record",
      `${data.student.fullName} · ${data.student.registrationNumber}`,
      null
    );

    if (options.includeProfile) {
      sectionTitle(doc, "Student Details");
      const rows: [string, string][] = [
        ["Full Name", data.student.fullName],
        ["Registration Number", data.student.registrationNumber],
        ["Gender", data.student.gender],
        ["Phone", data.student.phone || "-"],
        ["Course", data.student.course],
        ["Level / Semester", `${data.student.level} · ${data.student.semester}`],
        ["Academic Year", data.student.academicYear],
        ["Status", data.student.status],
        ["Registered On", data.student.registeredOn],
      ];
      for (const [label, value] of rows) {
        drawTableRow(doc, [
          { text: label, width: COL.label },
          { text: value, width: COL.value, ellipsis: true },
        ]);
      }
      doc.moveDown(0.8);
    }

    if (data.attendance) {
      sectionTitle(doc, `Attendance — ${data.filters.attendanceRange}`);
      drawTableRow(
        doc,
        [
          { text: "Module", width: 200 },
          { text: "Present", width: 60, align: "right" },
          { text: "Absent", width: 60, align: "right" },
          { text: "Sessions", width: 60, align: "right" },
          { text: "Attendance", width: 70, align: "right" },
          { text: "Status", width: 65, align: "center" },
        ],
        { bold: true }
      );

      for (const m of data.attendance.modules) {
        pageBreakIfNeeded(doc, data, options);
        drawTableRow(doc, [
          { text: m.module, width: 200, ellipsis: true },
          { text: String(m.present), width: 60, align: "right" },
          { text: String(m.absent), width: 60, align: "right" },
          { text: String(m.total), width: 60, align: "right" },
          { text: `${m.percentage}%`, width: 70, align: "right" },
          { text: m.meetsThreshold ? "OK" : "LOW", width: 65, align: "center" },
        ]);

        if (m.records) {
          for (const r of m.records) {
            pageBreakIfNeeded(doc, data, options);
            drawTableRow(
              doc,
              [
                { text: "", width: 20 },
                { text: r.date, width: 100 },
                { text: r.status, width: 70 },
                { text: r.remarks || "-", width: 325, ellipsis: true },
              ],
              { fontSize: 8 }
            );
          }
        }
      }

      if (data.attendance.modules.length === 0) {
        doc.font("Helvetica").fontSize(9).text("No attendance recorded for this selection.");
      } else {
        drawTableRow(
          doc,
          [
            { text: "OVERALL", width: 200 },
            { text: String(data.attendance.overall.present), width: 60, align: "right" },
            { text: String(data.attendance.overall.absent), width: 60, align: "right" },
            { text: String(data.attendance.overall.total), width: 60, align: "right" },
            { text: `${data.attendance.overall.percentage}%`, width: 70, align: "right" },
            { text: "", width: 65 },
          ],
          { bold: true }
        );
      }
      doc.moveDown(0.8);
    }

    if (data.assessments) {
      sectionTitle(doc, "Assessments");
      for (const m of data.assessments.modules) {
        pageBreakIfNeeded(doc, data, options);
        drawTableRow(
          doc,
          [
            { text: m.module, width: 240, ellipsis: true },
            { text: `${m.graded} / ${m.total} marked`, width: 130, align: "right" },
            {
              text: m.graded > 0 ? `average ${m.average}% · ${m.passes ? "PASS" : "REDO"}` : "nothing marked yet",
              width: 145,
              align: "right",
            },
          ],
          { bold: true }
        );
        for (const item of m.items) {
          pageBreakIfNeeded(doc, data, options);
          drawTableRow(
            doc,
            [
              { text: "", width: 20 },
              { text: item.name, width: 150, ellipsis: true },
              { text: item.date, width: 90 },
              {
                text: item.marks === null ? "not marked" : `${item.marks} / ${item.maxMarks}`,
                width: 100,
                align: "right",
              },
              { text: item.remarks || "-", width: 155, ellipsis: true },
            ],
            { fontSize: 8 }
          );
        }
      }

      if (data.assessments.modules.length === 0) {
        doc.font("Helvetica").fontSize(9).text("No assessments recorded for this selection.");
      } else {
        drawTableRow(
          doc,
          [
            { text: "OVERALL", width: 240 },
            {
              text: `${data.assessments.overall.graded} / ${data.assessments.overall.total} marked`,
              width: 130,
              align: "right",
            },
            {
              text:
                data.assessments.overall.graded > 0
                  ? `average ${data.assessments.overall.average}% · ${data.assessments.overall.passes ? "PASS" : "REDO"}`
                  : "nothing marked yet",
              width: 145,
              align: "right",
            },
          ],
          { bold: true }
        );
      }
      doc.moveDown(0.8);
    }

    if (options.includeSummary) {
      sectionTitle(doc, "Summary");
      doc.font("Helvetica").fontSize(9).fillColor("#111827");
      if (data.attendance) {
        doc.text(
          `Attendance: ${data.attendance.overall.percentage}% against a ${data.thresholds.attendance}% requirement.`
        );
      }
      if (data.assessments) {
        doc.text(
          data.assessments.overall.graded > 0
            ? `Assessments: an average of ${data.assessments.overall.average}% across ${data.assessments.overall.graded} marked assessment${data.assessments.overall.graded === 1 ? "" : "s"}, against a ${data.thresholds.passMark}% pass mark.`
            : "Assessments: none marked for this selection."
        );
      }
      doc.moveDown(0.5);
    }

    doc
      .fontSize(8)
      .fillColor("#888888")
      .text(`Generated on ${data.generatedAt}`, { align: "right" });
  });

  const safeName = data.student.registrationNumber.replace(/[^a-zA-Z0-9-]/g, "-");
  return { pdf, filename: `student-record-${safeName}-${dayjs().format("YYYYMMDD")}.pdf` };
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text(title);
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(9);
}

function pageBreakIfNeeded(
  doc: PDFKit.PDFDocument,
  data: StudentExportData,
  _options: StudentExportInput
) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - 30) {
    doc.addPage();
    addReportHeader(
      doc,
      data.institutionName,
      "Student Record",
      `${data.student.fullName} · ${data.student.registrationNumber}`,
      null
    );
  }
}
