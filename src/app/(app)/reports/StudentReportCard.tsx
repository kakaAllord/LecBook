"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import dayjs from "dayjs";
import { UserSearch, Download, Copy, Check, X } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import type { Assessment, Module, Paginated, Student } from "@/types";
import type { StudentExportInput } from "@/lib/validators/export";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { SearchInput } from "@/components/ui/SearchInput";
import { Button } from "@/components/ui/Button";
import { CheckboxGroup } from "@/components/ui/CheckboxGroup";

type ReportKind = "attendance" | "assessment";

/**
 * One student's record, on demand. Pick the person first, then say what you want
 * about them: a register over a date range, or their marks. Leaving a module or
 * assessment selection empty means all of them, which is the common case.
 */
export function StudentReportCard({ modules }: { modules: Module[] }) {
  const [search, setSearch] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [kind, setKind] = useState<ReportKind>("attendance");

  const [moduleIds, setModuleIds] = useState<string[]>([]);
  const [assessmentIds, setAssessmentIds] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [copied, setCopied] = useState(false);

  // Only search once there is something to search for — an empty box should not
  // pull the whole roll into a dropdown.
  const { data: matches } = useQuery({
    queryKey: ["students", "report-search", search],
    queryFn: () =>
      api.get<Paginated<Student>>(
        `/api/students?search=${encodeURIComponent(search)}&pageSize=8&page=1`
      ),
    enabled: search.trim().length > 1 && !student,
  });

  // A student can only hold records for modules their course actually runs.
  const relevantModules = student
    ? modules.filter((m) => m.courses.some((c) => c.id === student.courseId))
    : [];

  const { data: assessments } = useQuery({
    queryKey: ["assessments", "report-card", student?.courseId, moduleIds],
    queryFn: async () => {
      const selected = moduleIds.length > 0 ? moduleIds : relevantModules.map((m) => m.id);
      const results = await Promise.all(
        selected.map((moduleId) =>
          api.get<Assessment[]>(
            `/api/assessments?moduleId=${moduleId}&courseId=${student!.courseId}`
          )
        )
      );
      return results.flat();
    },
    enabled: kind === "assessment" && Boolean(student) && relevantModules.length > 0,
  });

  function reset() {
    setModuleIds([]);
    setAssessmentIds([]);
    setFrom("");
    setTo("");
  }

  function buildOptions(): StudentExportInput {
    const wantsAttendance = kind === "attendance";
    return {
      includeProfile: true,
      includeSummary: true,
      includeAttendance: wantsAttendance,
      attendanceModuleIds: wantsAttendance ? moduleIds : [],
      attendanceFrom: wantsAttendance ? from : "",
      attendanceTo: wantsAttendance ? to : "",
      attendanceDetail: "full",
      includeAssessments: !wantsAttendance,
      assessmentModuleIds: wantsAttendance ? [] : moduleIds,
      assessmentIds: wantsAttendance ? [] : assessmentIds,
      includeMissingMarks: true,
    };
  }

  const copyMutation = useMutation({
    mutationFn: () =>
      api.post<{ text: string }>(`/api/students/${student!.id}/export?format=text`, buildOptions()),
    onSuccess: async ({ text }) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Report copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("Could not access the clipboard");
      }
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Could not build the report");
    },
  });

  const pdfMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/students/${student!.id}/export?format=pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildOptions()),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Report failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${kind}-${student!.registrationNumber}-${dayjs().format("YYYYMMDD")}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: () => toast.error("Could not generate the report"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserSearch className="h-4 w-4 text-indigo-600" /> Student Report
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Everything on file for one student: their attendance over any range of dates, or their marks
          for whichever assessments you choose.
        </p>

        {student ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                {student.fullName}
              </p>
              <p className="text-xs text-slate-400">
                {student.registrationNumber}
                {student.course ? ` · ${student.course.name}` : ""}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setStudent(null);
                setSearch("");
                reset();
              }}
            >
              <X className="h-3.5 w-3.5" /> Change
            </Button>
          </div>
        ) : (
          <div>
            <Label htmlFor="student-report-search">Student</Label>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by name or registration number..."
            />
            {search.trim().length > 1 && (
              <ul className="mt-2 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                {(matches?.items ?? []).length === 0 ? (
                  <li className="px-3 py-2 text-sm text-slate-400">No student matches that</li>
                ) : (
                  matches!.items.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setStudent(s);
                          reset();
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {s.fullName}
                        </span>{" "}
                        <span className="text-xs text-slate-400">{s.registrationNumber}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        )}

        {student && (
          <>
            <div>
              <Label>Report</Label>
              <div className="flex gap-1 rounded-lg border border-slate-200 p-1 dark:border-slate-800">
                {(["attendance", "assessment"] as ReportKind[]).map((option) => (
                  <Button
                    key={option}
                    type="button"
                    size="sm"
                    className="flex-1"
                    variant={kind === option ? "primary" : "ghost"}
                    onClick={() => {
                      setKind(option);
                      reset();
                    }}
                  >
                    {option === "attendance" ? "Attendance" : "Assessments"}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="student-report-modules">Modules</Label>
              <CheckboxGroup
                options={relevantModules.map((m) => ({
                  id: m.id,
                  label: m.code ? `${m.name} (${m.code})` : m.name,
                }))}
                value={moduleIds}
                onChange={(ids) => {
                  setModuleIds(ids);
                  setAssessmentIds([]);
                }}
              />
              <p className="mt-1 text-xs text-slate-400">
                {moduleIds.length === 0
                  ? "None ticked — the report covers all modules."
                  : `${moduleIds.length} module${moduleIds.length === 1 ? "" : "s"} selected.`}
              </p>
            </div>

            {kind === "attendance" ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="student-report-from">From</Label>
                  <Input
                    id="student-report-from"
                    type="date"
                    value={from}
                    max={dayjs().format("YYYY-MM-DD")}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="student-report-to">To</Label>
                  <Input
                    id="student-report-to"
                    type="date"
                    value={to}
                    max={dayjs().format("YYYY-MM-DD")}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>
                <p className="col-span-2 -mt-2 text-xs text-slate-400">
                  Leave both empty for every date on record.
                </p>
              </div>
            ) : (
              <div>
                <Label htmlFor="student-report-assessments">Assessments</Label>
                <CheckboxGroup
                  options={(assessments ?? []).map((a) => ({
                    id: a.id,
                    label: `${a.name} · ${a.module.name} · ${dayjs(a.date).format("DD MMM YYYY")}`,
                  }))}
                  value={assessmentIds}
                  onChange={setAssessmentIds}
                />
                <p className="mt-1 text-xs text-slate-400">
                  {assessmentIds.length === 0
                    ? "None ticked — the report covers all assessments."
                    : `${assessmentIds.length} assessment${assessmentIds.length === 1 ? "" : "s"} selected.`}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1"
                loading={pdfMutation.isPending}
                onClick={() => pdfMutation.mutate()}
              >
                <Download className="h-4 w-4" /> Download PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                loading={copyMutation.isPending}
                onClick={() => copyMutation.mutate()}
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
