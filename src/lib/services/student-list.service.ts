import dayjs from "dayjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import type { Session } from "@/lib/auth";
import { studentScopeWhere } from "@/lib/scope";
import { getSettingsFor } from "@/lib/services/settings.service";
import { classCourseLabel, resolveClass } from "@/lib/services/teaching.service";
import { levelLabel, parseClassKey, romanLevel } from "@/lib/levels";
import {
  bufferPdf,
  addReportHeader,
  addParagraph,
  drawTableRow,
  fillWidth,
  fitColumn,
  usableWidth,
  HEADER_SHADE,
} from "@/lib/pdf";
import { STUDENT_LIST_STATUS_LABELS, type StudentListQuery } from "@/lib/validators/student-list";

export type StudentListRow = {
  registrationNumber: string;
  fullName: string;
  gender: string;
  phone: string | null;
  course: string;
  level: number;
  status: "ACTIVE" | "INACTIVE" | "COMPLETED";
};

export type StudentList = {
  institutionName: string;
  institutionLogo: string | null;
  /** "Mathematics Level I (MA101) · Electrical, Plumbing" or "Plumbing · Level II" */
  scope: string;
  status: string;
  students: StudentListRow[];
  generatedAt: string;
};

/**
 * The students matching a set of filters, within what the session may see.
 *
 * A lecturer's own scope (their courses at their levels) is always one of the
 * AND clauses, so a filter naming a course or level they do not teach returns
 * nobody rather than widening what they can see. A module is checked through
 * `resolveClass`, which refuses one they are not assigned.
 */
export async function buildStudentList(session: Session, query: StudentListQuery): Promise<StudentList> {
  const [scopeWhere, settings] = await Promise.all([studentScopeWhere(session), getSettingsFor(session)]);

  const filters: Prisma.StudentWhereInput[] = [scopeWhere];
  let scope: string;

  if (query.classKey) {
    const parsed = parseClassKey(query.classKey);
    if (!parsed) throw new ApiError("Choose a module at a level", 422);
    const cls = await resolveClass(session, parsed.moduleId, parsed.level, query.courseId ? [query.courseId] : undefined);
    filters.push({ level: cls.level, courseId: { in: cls.courses.map((c) => c.id) } });
    scope = `${cls.label}${cls.module.code ? ` (${cls.module.code})` : ""} · ${classCourseLabel(cls)}`;
  } else {
    let courseName = "All courses";
    if (query.courseId) {
      const course = await prisma.course.findUnique({ where: { id: query.courseId }, select: { name: true } });
      if (!course) throw new ApiError("Course not found", 404);
      courseName = course.name;
      filters.push({ courseId: query.courseId });
    }
    if (query.level) filters.push({ level: query.level });
    scope = `${courseName} · ${query.level ? levelLabel(query.level) : "All levels"}`;
  }

  if (query.status !== "ALL") filters.push({ status: query.status });

  const students = await prisma.student.findMany({
    where: { AND: filters },
    include: { course: { select: { name: true } } },
    orderBy: [{ course: { name: "asc" } }, { level: "asc" }, { fullName: "asc" }],
  });

  return {
    institutionName: settings.institutionName,
    institutionLogo: settings.institutionLogo,
    scope,
    status: STUDENT_LIST_STATUS_LABELS[query.status],
    students: students.map((s) => ({
      registrationNumber: s.registrationNumber,
      fullName: s.fullName,
      gender: s.gender,
      phone: s.phone,
      course: s.course.name,
      level: s.level,
      status: s.status,
    })),
    generatedAt: dayjs().format("DD MMM YYYY, HH:mm"),
  };
}

function statusLabel(status: StudentListRow["status"]) {
  return STUDENT_LIST_STATUS_LABELS[status];
}

/** "46 students · Active 41 · Inactive 5 · Female 23 · Male 23" — only the groups present. */
export function studentListTotals(students: StudentListRow[]) {
  const count = (values: string[]) => {
    const counts = new Map<string, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, n]) => `${label} ${n}`);
  };
  return [
    `${students.length} student${students.length === 1 ? "" : "s"}`,
    ...count(students.map((s) => statusLabel(s.status))),
    ...count(students.map((s) => s.gender)),
  ].join(" · ");
}

// Landscape widths at the 10pt report size. Reg. No is sized from the data and
// the name takes what is left, as on the registers.
const COLS = { no: 35, gender: 60, phone: 105, course: 170, level: 45, status: 70 };

export async function renderStudentListPdf(list: StudentList) {
  const subtitle = `${list.scope} · ${list.status}`;
  const pdf = await bufferPdf(
    (doc) => {
      let pages = 0;
      const header = () =>
        addReportHeader(doc, list.institutionName, "Student List", subtitle, list.institutionLogo, {
          continued: pages++ > 0,
        });

      header();
      if (list.students.length === 0) {
        addParagraph(doc, "No students match these filters.");
        return;
      }
      addParagraph(doc, studentListTotals(list.students), { bold: true });
      doc.moveDown(0.6);

      const reg = fitColumn(doc, ["Reg. No", ...list.students.map((s) => s.registrationNumber)], {
        min: 70,
        max: 130,
        bold: true,
      });
      const [no, regW, name, gender, phone, course, level, status] = fillWidth(
        [COLS.no, reg, 0, COLS.gender, COLS.phone, COLS.course, COLS.level, COLS.status],
        usableWidth(doc),
        2
      );
      const drawHeaderRow = () =>
        drawTableRow(
          doc,
          [
            { text: "No.", width: no },
            { text: "Reg. No", width: regW },
            { text: "Full Name", width: name },
            { text: "Gender", width: gender },
            { text: "Phone", width: phone },
            { text: "Course", width: course },
            { text: "Level", width: level },
            { text: "Status", width: status },
          ],
          { bold: true, shade: HEADER_SHADE }
        );
      drawHeaderRow();

      list.students.forEach((s, index) => {
        drawTableRow(
          doc,
          [
            { text: String(index + 1), width: no },
            { text: s.registrationNumber, width: regW },
            { text: s.fullName, width: name },
            { text: s.gender, width: gender },
            { text: s.phone || "-", width: phone },
            { text: s.course, width: course },
            { text: romanLevel(s.level), width: level },
            { text: statusLabel(s.status), width: status },
          ],
          {
            newPage: () => {
              header();
              drawHeaderRow();
            },
          }
        );
      });
    },
    { layout: "landscape", footer: { generatedAt: list.generatedAt } }
  );
  return pdf;
}

/**
 * A spreadsheet-ready copy. A cell that a spreadsheet would read as a formula
 * (starting `=`, `@`, or `+`/`-` followed by anything but a phone-like run of
 * digits) is prefixed with an apostrophe so opening the file cannot run it.
 */
function csvCell(value: string) {
  const risky = /^[=@\t\r]/.test(value) || (/^[+-]/.test(value) && !/^[+-][\d\s()-]*$/.test(value));
  const safe = risky ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function renderStudentListCsv(list: StudentList) {
  const rows = [
    ["No.", "Registration Number", "Full Name", "Gender", "Phone", "Course", "Level", "Status"],
    ...list.students.map((s, i) => [
      String(i + 1),
      s.registrationNumber,
      s.fullName,
      s.gender,
      s.phone ?? "",
      s.course,
      levelLabel(s.level),
      statusLabel(s.status),
    ]),
  ];
  // The byte-order mark makes Excel read the file as UTF-8, so names with
  // accents or apostrophes survive.
  return `﻿${rows.map((r) => r.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

/** "students-active-level-ii-20261120" */
export function studentListFilename(query: StudentListQuery, extension: "pdf" | "csv") {
  const parts = ["students", query.status !== "ALL" ? query.status.toLowerCase() : "", query.level && !query.classKey ? `level-${romanLevel(query.level).toLowerCase()}` : ""];
  return `${parts.filter(Boolean).join("-")}-${dayjs().format("YYYYMMDD")}.${extension}`;
}
