"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { Assessment, Module, UserRole } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { StudentReportCard } from "./StudentReportCard";

export function ReportsBoard({ role }: { role: UserRole }) {
  const { data: modules } = useQuery({
    queryKey: ["modules", "all"],
    queryFn: () => api.get<Module[]>("/api/modules?all=true"),
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
        <AttendanceReportCard modules={modules ?? []} />
        <AssessmentReportCard modules={modules ?? []} />
        <StudentReportCard modules={modules ?? []} />
      </div>
    </div>
  );
}

function ModuleCourseSelects({
  modules,
  moduleId,
  setModuleId,
  courseId,
  setCourseId,
  idPrefix,
}: {
  modules: Module[];
  moduleId: string;
  setModuleId: (id: string) => void;
  courseId: string;
  setCourseId: (id: string) => void;
  idPrefix: string;
}) {
  const selectedModule = modules.find((m) => m.id === moduleId);
  return (
    <>
      <div>
        <Label htmlFor={`${idPrefix}-module`}>Module</Label>
        <Select
          id={`${idPrefix}-module`}
          value={moduleId}
          onChange={(e) => {
            setModuleId(e.target.value);
            setCourseId("");
          }}
        >
          <option value="">Select a module...</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-course`}>Course</Label>
        <Select id={`${idPrefix}-course`} value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={!moduleId}>
          <option value="">All courses in module</option>
          {selectedModule?.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
    </>
  );
}

function AttendanceReportCard({ modules }: { modules: Module[] }) {
  const [moduleId, setModuleId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const href = (() => {
    if (!moduleId) return undefined;
    const params = new URLSearchParams({ moduleId });
    if (courseId) params.set("courseId", courseId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/reports/attendance?${params.toString()}`;
  })();

  function handleClick(e: React.MouseEvent) {
    if (!moduleId) {
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
          modules={modules}
          moduleId={moduleId}
          setModuleId={setModuleId}
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

function AssessmentReportCard({ modules }: { modules: Module[] }) {
  const [moduleId, setModuleId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [assessmentId, setAssessmentId] = useState("");

  const { data: assessments } = useQuery({
    queryKey: ["assessments", moduleId, courseId, "report"],
    queryFn: () => {
      const params = new URLSearchParams();
      if (moduleId) params.set("moduleId", moduleId);
      if (courseId) params.set("courseId", courseId);
      return api.get<Assessment[]>(`/api/assessments?${params.toString()}`);
    },
    enabled: Boolean(moduleId),
  });

  const href =
    assessmentId === "__all__"
      ? moduleId
        ? `/api/reports/assessment?moduleId=${moduleId}${courseId ? `&courseId=${courseId}` : ""}`
        : undefined
      : assessmentId
        ? `/api/reports/assessment?assessmentId=${assessmentId}`
        : undefined;

  function handleClick(e: React.MouseEvent) {
    if (assessmentId === "__all__") {
      if (!moduleId) {
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
          modules={modules}
          moduleId={moduleId}
          setModuleId={(id) => {
            setModuleId(id);
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
          <Select id="ass-assessment" value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)} disabled={!moduleId}>
            <option value="">Select an assessment...</option>
            <option value="__all__">All Assessments{moduleId ? "" : " (select a module first)"}</option>
            {assessments?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.courses.map((c) => c.name).join(", ")}
              </option>
            ))}
          </Select>
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
