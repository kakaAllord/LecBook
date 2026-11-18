"use client";

import { Plus, Trash2 } from "lucide-react";
import type { Course, Module } from "@/types";
import type { TeachingAssignmentInput } from "@/lib/validators/user";
import { LEVELS, levelLabel } from "@/lib/levels";
import { Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CheckboxGroup } from "@/components/ui/CheckboxGroup";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

/**
 * One line of the form: a module, the levels the lecturer teaches it at, and
 * the courses they teach it to. Several levels on one line are saved as one
 * assignment per level.
 */
export type AssignmentRow = { id: string; moduleId: string; levels: number[]; courseIds: string[] };

let rowSeq = 0;
export function newRow(partial: Partial<AssignmentRow> = {}): AssignmentRow {
  rowSeq += 1;
  return { id: `row-${rowSeq}`, moduleId: "", levels: [], courseIds: [], ...partial };
}

/** Saved lines → editable rows, one per module and level. */
export function rowsFromTeaching(lines: { moduleId: string; level: number; courses: { id: string }[] }[]) {
  return lines.map((l) => newRow({ moduleId: l.moduleId, levels: [l.level], courseIds: l.courses.map((c) => c.id) }));
}

export function rowsToAssignments(rows: AssignmentRow[]): TeachingAssignmentInput[] {
  return rows
    .filter((r) => r.moduleId)
    .flatMap((r) => r.levels.map((level) => ({ moduleId: r.moduleId, level, courseIds: r.courseIds })));
}

/** The first problem with the rows, phrased for the person filling them in, or null. */
export function rowsProblem(rows: AssignmentRow[], modules: Module[]) {
  for (const r of rows) {
    if (!r.moduleId) return "Choose a module on every line, or remove the empty line.";
    const m = modules.find((x) => x.id === r.moduleId);
    const name = m?.name ?? "a module";
    if (r.levels.length === 0) return `Choose at least one level for ${name}.`;
    if (r.courseIds.length === 0) return `Choose at least one course for ${name}.`;
  }
  return null;
}

export function TeachingAssignmentsEditor({
  rows,
  onChange,
  modules,
  courses,
}: {
  rows: AssignmentRow[];
  onChange: (rows: AssignmentRow[]) => void;
  modules: Module[];
  courses: Course[];
}) {
  const update = (id: string, patch: Partial<AssignmentRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // Choosing the module settles whatever the module fixes: a related module is
  // taught only at its own level; a core module only to its own course.
  function chooseModule(id: string, moduleId: string) {
    const m = modules.find((x) => x.id === moduleId);
    if (!m) return update(id, { moduleId: "", levels: [], courseIds: [] });
    if (m.kind === "CORE") update(id, { moduleId, levels: [], courseIds: m.courseId ? [m.courseId] : [] });
    else update(id, { moduleId, levels: m.level ? [m.level] : [], courseIds: [] });
  }

  const moduleOptions = modules.map((m) => ({
    value: m.id,
    label: m.kind === "CORE" ? m.name : `${m.name} (${levelLabel(m.level ?? 1)})`,
    hint:
      m.kind === "CORE"
        ? `Core module of ${m.course?.name ?? "its course"}, Level I–III${m.code ? ` · ${m.code}` : ""}`
        : `Related module, every course${m.code ? ` · ${m.code}` : ""}`,
  }));

  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-700">
          Nothing assigned yet. Add the modules this lecturer teaches.
        </p>
      )}

      {rows.map((row, index) => {
        const m = modules.find((x) => x.id === row.moduleId);
        return (
          <div
            key={row.id}
            className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
          >
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Label htmlFor={`${row.id}-module`}>Module {rows.length > 1 ? index + 1 : ""}</Label>
                <SearchableSelect
                  id={`${row.id}-module`}
                  value={row.moduleId}
                  onChange={(value) => chooseModule(row.id, value)}
                  placeholder="Choose a module..."
                  options={moduleOptions}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                title="Remove this line"
                onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>

            {m && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Level</Label>
                  {m.kind === "CORE" ? (
                    <CheckboxGroup
                      options={LEVELS.map((l) => ({ id: String(l), label: levelLabel(l) }))}
                      value={row.levels.map(String)}
                      onChange={(ids) => update(row.id, { levels: ids.map(Number).sort() })}
                    />
                  ) : (
                    <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                      {levelLabel(m.level ?? 1)} — a related module runs at its own level only.
                    </p>
                  )}
                </div>
                <div>
                  <Label>Courses</Label>
                  {m.kind === "CORE" ? (
                    <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                      {m.course?.name} — a core module is taught to its own course only.
                    </p>
                  ) : (
                    <CheckboxGroup
                      options={courses.map((c) => ({ id: c.id, label: c.name }))}
                      value={row.courseIds}
                      onChange={(ids) => update(row.id, { courseIds: ids })}
                      searchPlaceholder="Search courses…"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, newRow()])}>
        <Plus className="h-4 w-4" /> Add a module
      </Button>
    </div>
  );
}
