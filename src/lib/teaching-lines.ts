import { classKey, moduleAtLevelLabel } from "@/lib/levels";

/**
 * One line of what a lecturer teaches, as people read it: "Mathematics Level I
 * — Electrical, Plumbing". Shared by the server, which builds these from the
 * stored rows, and the browser, which shows and edits them.
 */
export type TeachingLine = {
  key: string;
  moduleId: string;
  moduleName: string;
  code: string | null;
  kind: "CORE" | "RELATED";
  level: number;
  label: string;
  courses: { id: string; name: string }[];
};

type AssignmentRow = {
  moduleId: string;
  level: number;
  module: { name: string; code: string | null; kind: "CORE" | "RELATED" };
  course: { id: string; name: string };
};

/** Groups one-row-per-course assignments back into one line per module and level. */
export function toTeachingLines(rows: AssignmentRow[]): TeachingLine[] {
  const lines = new Map<string, TeachingLine>();
  for (const r of rows) {
    const key = classKey(r.moduleId, r.level);
    if (!lines.has(key)) {
      lines.set(key, {
        key,
        moduleId: r.moduleId,
        moduleName: r.module.name,
        code: r.module.code,
        kind: r.module.kind,
        level: r.level,
        label: moduleAtLevelLabel(r.module.name, r.level),
        courses: [],
      });
    }
    lines.get(key)!.courses.push(r.course);
  }
  return Array.from(lines.values())
    .map((l) => ({ ...l, courses: l.courses.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.moduleName.localeCompare(b.moduleName) || a.level - b.level);
}
