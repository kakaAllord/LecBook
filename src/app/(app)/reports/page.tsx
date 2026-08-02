"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { Assessment, Course } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function ReportsPage() {
  const { data: courses } = useQuery({
    queryKey: ["courses", "all"],
    queryFn: () => api.get<Course[]>("/api/courses?all=true"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Reports</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Generate printable PDF reports for attendance and assessments.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AttendanceReportCard courses={courses ?? []} />
        <AssessmentReportCard courses={courses ?? []} />
      </div>
    </div>
  );
}

function AttendanceReportCard({ courses }: { courses: Course[] }) {
  const [courseId, setCourseId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const href = (() => {
    if (!courseId) return undefined;
    const params = new URLSearchParams({ courseId });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/reports/attendance?${params.toString()}`;
  })();

  function handleClick(e: React.MouseEvent) {
    if (!courseId) {
      e.preventDefault();
      toast.error("Select a course first");
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
        <div>
          <Label htmlFor="att-course">Course</Label>
          <Select id="att-course" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Select a course...</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.level} · {c.semester}
              </option>
            ))}
          </Select>
        </div>
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

function AssessmentReportCard({ courses }: { courses: Course[] }) {
  const [courseId, setCourseId] = useState("");
  const [assessmentId, setAssessmentId] = useState("");

  const { data: assessments } = useQuery({
    queryKey: ["assessments", courseId, "report"],
    queryFn: () => api.get<Assessment[]>(`/api/assessments${courseId ? `?courseId=${courseId}` : ""}`),
  });

  const href =
    assessmentId === "__all__"
      ? courseId
        ? `/api/reports/assessment?courseId=${courseId}`
        : undefined
      : assessmentId
        ? `/api/reports/assessment?assessmentId=${assessmentId}`
        : undefined;

  function handleClick(e: React.MouseEvent) {
    if (assessmentId === "__all__") {
      if (!courseId) {
        e.preventDefault();
        toast.error("Select a course first to download all its assessments");
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
          course to get a combined score summary.
        </p>
        <div>
          <Label htmlFor="ass-course">Course</Label>
          <Select
            id="ass-course"
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setAssessmentId("");
            }}
          >
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="ass-assessment">Assessment</Label>
          <Select id="ass-assessment" value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)}>
            <option value="">Select an assessment...</option>
            <option value="__all__">All Assessments{courseId ? "" : " (select a course first)"}</option>
            {assessments?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} · {a.assessmentType.name} · {a.course.name}
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
