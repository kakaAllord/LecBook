"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { Assessment, TeachingUnit, UserRole } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { StudentReportCard } from "./StudentReportCard";
import { StudentListCard } from "./StudentListCard";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

export function ReportsBoard({ role }: { role: UserRole }) {
  // Every picker here offers a module at a level: "Electrical Installation Level I".
  const { data: units } = useQuery({
    queryKey: ["teaching-units"],
    queryFn: () => api.get<TeachingUnit[]>("/api/teaching-units"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Reports</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {role === "ADMIN"
            ? "Printable PDF reports across every course and module in the institution."
            : "Printable PDF reports for the modules you teach."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AttendanceReportCard units={units ?? []} />
        <AssessmentReportCard units={units ?? []} />
        <StudentReportCard units={units ?? []} />
        <StudentListCard units={units ?? []} />
      </div>
    </div>
  );
}

/** Query-string parameters naming a module at a level, plus an optional course. */
function classParams(unit: TeachingUnit, courseId: string) {
  const params = new URLSearchParams({ moduleId: unit.moduleId, level: String(unit.level) });
  if (courseId) params.set("courseId", courseId);
  return params;
}

function ModuleCourseSelects({
  units,
  unitKey,
  setUnitKey,
  courseId,
  setCourseId,
  idPrefix,
}: {
  units: TeachingUnit[];
  unitKey: string;
  setUnitKey: (key: string) => void;
  courseId: string;
  setCourseId: (id: string) => void;
  idPrefix: string;
}) {
  const selectedUnit = units.find((u) => u.key === unitKey);
  return (
    <>
      <div>
        <Label htmlFor={`${idPrefix}-module`}>Module</Label>
        <SearchableSelect
          id={`${idPrefix}-module`}
          value={unitKey}
          onChange={(value) => {
            setUnitKey(value);
            setCourseId("");
          }}
          placeholder="Select a module..."
          options={units.map((u) => ({ value: u.key, label: u.label, hint: u.code ?? undefined }))}
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-course`}>Course</Label>
        <SearchableSelect
          id={`${idPrefix}-course`}
          value={courseId}
          onChange={setCourseId}
          disabled={!selectedUnit}
          emptyOption="All courses in module"
          options={(selectedUnit?.courses ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
      </div>
    </>
  );
}

function AttendanceReportCard({ units }: { units: TeachingUnit[] }) {
  const [unitKey, setUnitKey] = useState("");
  const [courseId, setCourseId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const unit = units.find((u) => u.key === unitKey);

  const href = (() => {
    if (!unit) return undefined;
    const params = classParams(unit, courseId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/reports/attendance?${params.toString()}`;
  })();

  function handleClick(e: React.MouseEvent) {
    if (!unit) {
      e.preventDefault();
      toast.error("Select a module first");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-indigo-600" /> Attendance Report
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          A tick-sheet register: one row per student, one column per date, with attendance totals.
        </p>
        <ModuleCourseSelects
          units={units}
          unitKey={unitKey}
          setUnitKey={setUnitKey}
          courseId={courseId}
          setCourseId={setCourseId}
          idPrefix="att"
        />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="att-from">From</Label>
            <Input id="att-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={dayjs().format("YYYY-MM-DD")} />
          </div>
          <div>
            <Label htmlFor="att-to">To</Label>
            <Input id="att-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} max={dayjs().format("YYYY-MM-DD")} />
          </div>
        </div>
        <a href={href ?? "#"} target="_blank" rel="noreferrer" onClick={handleClick}>
          <Button type="button" className="w-full">
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </a>
      </CardContent>
    </Card>
  );
}

function AssessmentReportCard({ units }: { units: TeachingUnit[] }) {
  const [unitKey, setUnitKey] = useState("");
  const [courseId, setCourseId] = useState("");
  const [assessmentId, setAssessmentId] = useState("");
  const unit = units.find((u) => u.key === unitKey);

  const { data: assessments } = useQuery({
    queryKey: ["assessments", unitKey, courseId, "report"],
    queryFn: () => api.get<Assessment[]>(`/api/assessments?${classParams(unit!, courseId).toString()}`),
    enabled: Boolean(unit),
  });

  const href =
    assessmentId === "__all__"
      ? unit
        ? `/api/reports/assessment?${classParams(unit, courseId).toString()}`
        : undefined
      : assessmentId
        ? `/api/reports/assessment?assessmentId=${assessmentId}`
        : undefined;

  function handleClick(e: React.MouseEvent) {
    if (assessmentId === "__all__") {
      if (!unit) {
        e.preventDefault();
        toast.error("Select a module first to download all its assessments");
      }
      return;
    }
    if (!assessmentId) {
      e.preventDefault();
      toast.error("Select an assessment first");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-indigo-600" /> Assessment Report
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Includes marks per student and a signature column. Choose one assessment, or all assessments for a
          module (and optionally one course) to get a combined score summary.
        </p>
        <ModuleCourseSelects
          units={units}
          unitKey={unitKey}
          setUnitKey={(key) => {
            setUnitKey(key);
            setAssessmentId("");
          }}
          courseId={courseId}
          setCourseId={(id) => {
            setCourseId(id);
            setAssessmentId("");
          }}
          idPrefix="ass"
        />
        <div>
          <Label htmlFor="ass-assessment">Assessment</Label>
          <SearchableSelect
            id="ass-assessment"
            value={assessmentId}
            onChange={setAssessmentId}
            disabled={!unit}
            placeholder="Select an assessment..."
            options={[
              { value: "__all__", label: "All Assessments" },
              ...(assessments ?? []).map((a) => ({
                value: a.id,
                label: a.name,
                hint: a.courses.map((c) => c.name).join(", "),
              })),
            ]}
          />
        </div>
        <a href={href ?? "#"} target="_blank" rel="noreferrer" onClick={handleClick}>
          <Button type="button" className="w-full">
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </a>
      </CardContent>
    </Card>
  );
}
