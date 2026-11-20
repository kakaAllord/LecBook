"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Download, FileSpreadsheet } from "lucide-react";
import { api } from "@/lib/api-client";
import type { Course, TeachingUnit } from "@/types";
import { LEVELS, levelLabel, romanLevel } from "@/lib/levels";
import {
  STUDENT_LIST_STATUSES,
  STUDENT_LIST_STATUS_LABELS,
  type StudentListStatus,
} from "@/lib/validators/student-list";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

/**
 * A list of students, pulled out as a PDF or a spreadsheet. Every filter is
 * optional and they combine. Choosing a module gives the students it is
 * taught to, which fixes the level, so the level buttons step aside.
 */
export function StudentListCard({ units }: { units: TeachingUnit[] }) {
  const [status, setStatus] = useState<StudentListStatus>("ACTIVE");
  const [level, setLevel] = useState<number | null>(null);
  const [unitKey, setUnitKey] = useState("");
  const [courseId, setCourseId] = useState("");
  const unit = units.find((u) => u.key === unitKey);

  // Scoped on the server: a lecturer gets only the courses they teach.
  const { data: courses } = useQuery({
    queryKey: ["courses", "all"],
    queryFn: () => api.get<Course[]>("/api/courses?all=true"),
  });
  const courseOptions = (unit ? unit.courses : (courses ?? [])).map((c) => ({ value: c.id, label: c.name }));

  const params = new URLSearchParams({ status });
  if (unit) params.set("classKey", unit.key);
  else if (level) params.set("level", String(level));
  if (courseId) params.set("courseId", courseId);
  const href = (format: "pdf" | "csv") => `/api/reports/students?${params.toString()}&format=${format}`;

  const courseName = courseOptions.find((c) => c.value === courseId)?.label;
  const who = [
    status === "ALL" ? "All students" : `${STUDENT_LIST_STATUS_LABELS[status]} students`,
    unit ? `taking ${unit.label}` : level ? `at ${levelLabel(level)}` : "at every level",
    courseName ? `on ${courseName}` : unit ? "on all of its courses" : "on every course",
  ].join(" ");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4 text-indigo-600" /> Student List
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          A list of students with their registration number, gender, phone, course, level and status. Narrow it by
          any of the filters, or leave them as they are for everyone.
        </p>

        <div>
          <Label>Status</Label>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 p-1 sm:grid-cols-4 dark:border-slate-800">
            {STUDENT_LIST_STATUSES.map((option) => (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={status === option ? "primary" : "ghost"}
                aria-pressed={status === option}
                onClick={() => setStatus(option)}
              >
                {option === "ALL" ? "All" : STUDENT_LIST_STATUS_LABELS[option]}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="list-module">Module (optional)</Label>
          <SearchableSelect
            id="list-module"
            value={unitKey}
            onChange={(value) => {
              setUnitKey(value);
              setCourseId("");
            }}
            emptyOption="Any module"
            options={units.map((u) => ({ value: u.key, label: u.label, hint: u.code ?? undefined }))}
          />
        </div>

        <div>
          <Label>Level</Label>
          {unit ? (
            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              {levelLabel(unit.level)}, set by the module.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-1 rounded-lg border border-slate-200 p-1 dark:border-slate-800">
              {[null, ...LEVELS].map((option) => (
                <Button
                  key={option ?? "all"}
                  type="button"
                  size="sm"
                  variant={level === option ? "primary" : "ghost"}
                  aria-pressed={level === option}
                  onClick={() => setLevel(option)}
                >
                  {option === null ? "All" : romanLevel(option)}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="list-course">Course</Label>
          <SearchableSelect
            id="list-course"
            value={courseId}
            onChange={setCourseId}
            emptyOption={unit ? "All courses taking the module" : "All courses"}
            options={courseOptions}
          />
        </div>

        <p className="text-xs text-slate-400">{who}.</p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <a href={href("pdf")} target="_blank" rel="noreferrer" className="flex-1">
            <Button type="button" className="w-full">
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          </a>
          <a href={href("csv")} className="flex-1">
            <Button type="button" variant="outline" className="w-full">
              <FileSpreadsheet className="h-4 w-4" /> Download CSV
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
