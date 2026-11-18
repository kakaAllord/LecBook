import dayjs from "dayjs";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import {
  bufferPdf,
  addReportHeader,
  addSectionTitle,
  addParagraph,
  addGeneratedFooter,
  drawTableRow,
  needsPageBreak,
  HEADER_SHADE,
} from "@/lib/pdf";
import { computeStanding, passes, roundPercentage } from "@/lib/grading";
import { getSettingsFor } from "@/lib/services/settings.service";
import type { Session } from "@/lib/auth";
import { toUtcDayStart, toUtcDayEnd } from "@/lib/date";
import { getAssignments } from "@/lib/scope";
import { levelLabel, moduleAtLevelLabel, parseClassKey } from "@/lib/levels";
import type { StudentExportInput } from "@/lib/validators/export";

export type StudentExportData = {
  generatedAt: string;
  institutionName: string;
  institutionLogo: string | null;
  student: {
    registrationNumber: string;
    fullName: string;
    gender: string;
    phone: string | null;
    status: string;
    course: string;
    level: string;
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

type ClassRef = { moduleId: string; level: number };

/**
 * Narrows a chosen set of classes (modules at a level) to the ones the reader
 * may see. `null` means no restriction; an empty array means nothing matches,
 * which is why the selection cannot simply fall back to "everything" when the
 * intersection empties.
 */
function scopedClasses(selectedKeys: string[], scope: ClassRef[] | null): ClassRef[] | null {
  const selected: ClassRef[] = [];
  for (const key of selectedKeys) {
    const parsed = parseClassKey(key);
    if (parsed) selected.push(parsed);
  }
  if (scope === null) return selected.length > 0 ? selected : null;
  if (selected.length === 0) return scope;
  return selected.filter((c) => scope.some((s) => s.moduleId === c.moduleId && s.level === c.level));
}

/** A `where` fragment matching records in any of the given classes. */
function classFilter(classes: ClassRef[] | null) {
  if (classes === null) return {};
  if (classes.length === 0) return { id: "__nothing_selected__" };
  return { OR: classes.map((c) => ({ moduleId: c.moduleId, level: c.level })) };
}

/** "Electrical Installation Level I (EI101)" */
function classHeading(module_: { name: string; code: string | null }, level: number) {
  const label = moduleAtLevelLabel(module_.name, level);
  return module_.code ? `${label} (${module_.code})` : label;
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

  // A lecturer exports a student through the classes they teach, so the chosen
  // ones are intersected with their assignments rather than trusted.
  const rows = await getAssignments(session);
  const scope = rows === null ? null : rows.map((r) => ({ moduleId: r.moduleId, level: r.level }));
  const attendanceClasses = scopedClasses(options.attendanceClassKeys ?? [], scope);
  const assessmentClasses = scopedClasses(options.assessmentClassKeys ?? [], scope);
  const assessmentIds = options.assessmentIds ?? [];

  const from = options.attendanceFrom ? toUtcDayStart(options.attendanceFrom) ?? undefined : undefined;
  const to = options.attendanceTo ? toUtcDayEnd(options.attendanceTo) ?? undefined : undefined;

  const data: StudentExportData = {
    generatedAt: dayjs().format("DD MMM YYYY, HH:mm"),
    institutionName: settings.institutionName,
    institutionLogo: settings.institutionLogo,
    student: {
      registrationNumber: student.registrationNumber,
      fullName: student.fullName,
      gender: student.gender,
      phone: student.phone,
      status: student.status,
      course: student.course.name,
      level: levelLabel(student.level),
      registeredOn: dayjs(student.createdAt).format("DD MMM YYYY"),
    },
    filters: {
      attendanceRange:
        from || to
          ? `${from ? dayjs(from).format("DD MMM YYYY") : "start"} to ${to ? dayjs(to).format("DD MMM YYYY") : "today"}`
          : "All recorded dates",
      attendanceModules: options.attendanceClassKeys?.length ? `${options.attendanceClassKeys.length} selected` : "All modules",
      assessmentModules: options.assessmentClassKeys?.length ? `${options.assessmentClassKeys.length} selected` : "All modules",
      assessments: assessmentIds.length > 0 ? `${assessmentIds.length} selected` : "All assessments",
    },
    thresholds: { attendance: settings.attendanceThreshold, passMark: settings.assessmentPassMark },
  };

  if (options.includeAttendance) {
    const records = await prisma.attendance.findMany({
      where: {
        studentId,
        ...classFilter(attendanceClasses),
        ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      include: { module: true },
      orderBy: [{ module: { name: "asc" } }, { level: "asc" }, { date: "asc" }],
    });

    const byModule = new Map<string, typeof records>();
    for (const record of records) {
      const key = classHeading(record.module, record.level);
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
        ...classFilter(assessmentClasses),
        ...(assessmentIds.length > 0 ? { id: { in: assessmentIds } } : {}),
      },
      include: { module: true, marks: { where: { studentId } } },
      orderBy: [{ module: { name: "asc" } }, { level: "asc" }, { date: "asc" }],
    });

    const byModule = new Map<string, typeof assessments>();
    for (const assessment of assessments) {
      const mark = assessment.marks[0];
      if (!mark && !options.includeMissingMarks) continue;
      const key = classHeading(assessment.module, assessment.level);
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
    lines.push(`  Level:           ${data.student.level}`);
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
          ? `  ${m.module} — average ${m.average}% over ${m.graded} of ${m.total} assessment${m.total === 1 ? "" : "s"} — ${m.passes ? "PASS" : "FAIL"}`
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
        ? `  OVERALL: average ${data.assessments.overall.average}% over ${data.assessments.overall.graded} of ${data.assessments.overall.total} assessments — ${data.assessments.overall.passes ? "PASS" : "FAIL"}`
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

// Portrait widths at the 10pt report size; each table spans the usable width.
const PROFILE = { label: 175, value: 340 };
const ATTENDANCE = { module: 175, present: 65, absent: 65, sessions: 70, rate: 70, status: 70 };
const RECORD = { date: 175, status: 130, remarks: 210 };
const ASSESSMENT = { name: 155, date: 110, marks: 110, remarks: 140 };
const ASSESSMENT_MODULE = { module: 215, marked: 130, result: 170 };

export async function renderStudentExportPdf(data: StudentExportData, options: StudentExportInput) {
  const pdf = await bufferPdf((doc) => {
    const header = () =>
      addReportHeader(
        doc,
        data.institutionName,
        "Student Record",
        `${data.student.fullName} · ${data.student.registrationNumber}`,
        data.institutionLogo
      );
    const breakIfNeeded = () => {
      if (needsPageBreak(doc)) {
        doc.addPage();
        header();
      }
    };

    header();

    if (options.includeProfile) {
      addSectionTitle(doc, "Student Details");
      const rows: [string, string][] = [
        ["Full Name", data.student.fullName],
        ["Registration Number", data.student.registrationNumber],
        ["Gender", data.student.gender],
        ["Phone", data.student.phone || "-"],
        ["Course", data.student.course],
        ["Level", data.student.level],
        ["Status", data.student.status],
        ["Registered On", data.student.registeredOn],
      ];
      for (const [label, value] of rows) {
        breakIfNeeded();
        drawTableRow(doc, [
          { text: label, width: PROFILE.label },
          { text: value, width: PROFILE.value },
        ]);
      }
      doc.moveDown(0.8);
    }

    if (data.attendance) {
      addSectionTitle(doc, `Attendance — ${data.filters.attendanceRange}`);
      drawTableRow(
        doc,
        [
          { text: "Module", width: ATTENDANCE.module },
          { text: "Present", width: ATTENDANCE.present },
          { text: "Absent", width: ATTENDANCE.absent },
          { text: "Sessions", width: ATTENDANCE.sessions },
          { text: "Attendance", width: ATTENDANCE.rate },
          { text: "Status", width: ATTENDANCE.status },
        ],
        { bold: true, shade: HEADER_SHADE, wrap: true }
      );

      for (const m of data.attendance.modules) {
        breakIfNeeded();
        drawTableRow(doc, [
          { text: m.module, width: ATTENDANCE.module },
          { text: String(m.present), width: ATTENDANCE.present },
          { text: String(m.absent), width: ATTENDANCE.absent },
          { text: String(m.total), width: ATTENDANCE.sessions },
          { text: `${m.percentage}%`, width: ATTENDANCE.rate },
          { text: m.meetsThreshold ? "OK" : "LOW", width: ATTENDANCE.status, status: { positive: m.meetsThreshold } },
        ]);

        if (m.records) {
          for (const r of m.records) {
            breakIfNeeded();
            drawTableRow(doc, [
              { text: r.date, width: RECORD.date },
              { text: r.status, width: RECORD.status },
              { text: r.remarks || "-", width: RECORD.remarks },
            ]);
          }
        }
      }

      if (data.attendance.modules.length === 0) {
        addParagraph(doc, "No attendance recorded for this selection.");
      } else {
        breakIfNeeded();
        drawTableRow(
          doc,
          [
            { text: "OVERALL", width: ATTENDANCE.module },
            { text: String(data.attendance.overall.present), width: ATTENDANCE.present },
            { text: String(data.attendance.overall.absent), width: ATTENDANCE.absent },
            { text: String(data.attendance.overall.total), width: ATTENDANCE.sessions },
            { text: `${data.attendance.overall.percentage}%`, width: ATTENDANCE.rate },
            { text: "", width: ATTENDANCE.status },
          ],
          { bold: true, shade: HEADER_SHADE, wrap: true }
        );
      }
      doc.moveDown(0.8);
    }

    if (data.assessments) {
      addSectionTitle(doc, "Assessments");
      for (const m of data.assessments.modules) {
        breakIfNeeded();
        drawTableRow(
          doc,
          [
            { text: m.module, width: ASSESSMENT_MODULE.module },
            { text: `${m.graded} / ${m.total} marked`, width: ASSESSMENT_MODULE.marked },
            {
              text: m.graded > 0 ? `average ${m.average}% · ${m.passes ? "PASS" : "FAIL"}` : "nothing marked yet",
              width: ASSESSMENT_MODULE.result,
            },
          ],
          { bold: true, shade: HEADER_SHADE, wrap: true }
        );
        for (const item of m.items) {
          breakIfNeeded();
          drawTableRow(doc, [
            { text: item.name, width: ASSESSMENT.name },
            { text: item.date, width: ASSESSMENT.date },
            { text: item.marks === null ? "not marked" : `${item.marks} / ${item.maxMarks}`, width: ASSESSMENT.marks },
            { text: item.remarks || "-", width: ASSESSMENT.remarks },
          ]);
        }
      }

      if (data.assessments.modules.length === 0) {
        addParagraph(doc, "No assessments recorded for this selection.");
      } else {
        breakIfNeeded();
        drawTableRow(
          doc,
          [
            { text: "OVERALL", width: ASSESSMENT_MODULE.module },
            {
              text: `${data.assessments.overall.graded} / ${data.assessments.overall.total} marked`,
              width: ASSESSMENT_MODULE.marked,
            },
            {
              text:
                data.assessments.overall.graded > 0
                  ? `average ${data.assessments.overall.average}% · ${data.assessments.overall.passes ? "PASS" : "FAIL"}`
                  : "nothing marked yet",
              width: ASSESSMENT_MODULE.result,
            },
          ],
          { bold: true, shade: HEADER_SHADE, wrap: true }
        );
      }
      doc.moveDown(0.8);
    }

    if (options.includeSummary) {
      addSectionTitle(doc, "Summary");
      if (data.attendance) {
        addParagraph(
          doc,
          `Attendance: ${data.attendance.overall.percentage}% against a ${data.thresholds.attendance}% requirement.`
        );
      }
      if (data.assessments) {
        addParagraph(
          doc,
          data.assessments.overall.graded > 0
            ? `Assessments: an average of ${data.assessments.overall.average}% across ${data.assessments.overall.graded} marked assessment${data.assessments.overall.graded === 1 ? "" : "s"}, against a ${data.thresholds.passMark}% pass mark.`
            : "Assessments: none marked for this selection."
        );
      }
    }

    addGeneratedFooter(doc, data.generatedAt);
  });

  const safeName = data.student.registrationNumber.replace(/[^a-zA-Z0-9-]/g, "-");
  return { pdf, filename: `student-record-${safeName}-${dayjs().format("YYYYMMDD")}.pdf` };
}
