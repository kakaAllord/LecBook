"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Copy, Download, Check } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import type { Module, Student } from "@/types";
import type { StudentExportInput } from "@/lib/validators/export";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CheckboxGroup } from "@/components/ui/CheckboxGroup";
import { Select } from "@/components/ui/Select";

const DEFAULTS: StudentExportInput = {
  includeProfile: true,
  includeSummary: true,
  includeAttendance: true,
  attendanceModuleIds: [],
  attendanceFrom: "",
  attendanceTo: "",
  attendanceDetail: "summary",
  includeAssessments: true,
  assessmentModuleIds: [],
  includeMissingMarks: true,
};

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
      <span>
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</span>
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
    </label>
  );
}

export function StudentExportDialog({
  open,
  onClose,
  student,
}: {
  open: boolean;
  onClose: () => void;
  student: Student | null;
}) {
  const [options, setOptions] = useState<StudentExportInput>(DEFAULTS);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setOptions(DEFAULTS);
      setCopied(false);
    }
  }, [open]);

  const { data: modules } = useQuery({
    queryKey: ["modules", "all"],
    queryFn: () => api.get<Module[]>("/api/modules?all=true"),
    enabled: open,
  });

  // Only modules linked to this student's course can hold their records.
  const relevantModules = (modules ?? []).filter((m) =>
    student ? m.courses.some((c) => c.id === student.courseId) : false
  );

  const set = <K extends keyof StudentExportInput>(key: K, value: StudentExportInput[K]) =>
    setOptions((prev) => ({ ...prev, [key]: value }));

  const copyMutation = useMutation({
    mutationFn: () =>
      api.post<{ text: string }>(`/api/students/${student!.id}/export?format=text`, options),
    onSuccess: async ({ text }) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Record copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("Could not access the clipboard");
      }
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Could not build the export");
    },
  });

  const pdfMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/students/${student!.id}/export?format=pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `student-record-${student!.registrationNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success("Export downloaded"),
    onError: () => toast.error("Could not generate the PDF"),
  });

  if (!student) return null;

  const nothingSelected =
    !options.includeProfile && !options.includeAttendance && !options.includeAssessments;

  return (
    <Dialog open={open} onClose={onClose} size="lg" title={`Export — ${student.fullName}`}>
      <div className="space-y-5">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Pick exactly what you need. Everything is optional, so you can pull one module&apos;s attendance
          for a single week or the student&apos;s entire history.
        </p>

        <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <Toggle
            checked={options.includeProfile}
            onChange={(v) => set("includeProfile", v)}
            label="Student details"
            hint="Name, registration number, course, level, semester and status."
          />
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <Toggle
            checked={options.includeAttendance}
            onChange={(v) => set("includeAttendance", v)}
            label="Attendance"
            hint="Per-module totals and attendance percentage."
          />

          {options.includeAttendance && (
            <div className="space-y-3 border-l-2 border-slate-100 pl-4 dark:border-slate-800">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="exp-from">From</Label>
                  <Input
                    id="exp-from"
                    type="date"
                    value={options.attendanceFrom ?? ""}
                    max={dayjs().format("YYYY-MM-DD")}
                    onChange={(e) => set("attendanceFrom", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="exp-to">To</Label>
                  <Input
                    id="exp-to"
                    type="date"
                    value={options.attendanceTo ?? ""}
                    max={dayjs().format("YYYY-MM-DD")}
                    onChange={(e) => set("attendanceTo", e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400">Leave both dates empty for all recorded attendance.</p>

              <div>
                <Label htmlFor="exp-att-modules">Modules</Label>
                <CheckboxGroup
                  options={relevantModules.map((m) => ({
                    id: m.id,
                    label: m.code ? `${m.name} (${m.code})` : m.name,
                  }))}
                  value={options.attendanceModuleIds ?? []}
                  onChange={(ids) => set("attendanceModuleIds", ids)}
                  className="max-h-36"
                />
                <p className="mt-1 text-xs text-slate-400">Select none for every module.</p>
              </div>

              <div>
                <Label htmlFor="exp-detail">Level of detail</Label>
                <Select
                  id="exp-detail"
                  value={options.attendanceDetail}
                  onChange={(e) =>
                    set("attendanceDetail", e.target.value as StudentExportInput["attendanceDetail"])
                  }
                >
                  <option value="summary">Totals per module</option>
                  <option value="full">Totals plus every dated record</option>
                </Select>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <Toggle
            checked={options.includeAssessments}
            onChange={(v) => set("includeAssessments", v)}
            label="Assessments"
            hint="Marks per assessment with module and overall totals."
          />

          {options.includeAssessments && (
            <div className="space-y-3 border-l-2 border-slate-100 pl-4 dark:border-slate-800">
              <div>
                <Label htmlFor="exp-ass-modules">Modules</Label>
                <CheckboxGroup
                  options={relevantModules.map((m) => ({
                    id: m.id,
                    label: m.code ? `${m.name} (${m.code})` : m.name,
                  }))}
                  value={options.assessmentModuleIds ?? []}
                  onChange={(ids) => set("assessmentModuleIds", ids)}
                  className="max-h-36"
                />
                <p className="mt-1 text-xs text-slate-400">Select none for every module.</p>
              </div>
              <Toggle
                checked={options.includeMissingMarks}
                onChange={(v) => set("includeMissingMarks", v)}
                label="Show assessments with no mark yet"
                hint="Useful for spotting gaps; turn off for a clean transcript."
              />
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <Toggle
            checked={options.includeSummary}
            onChange={(v) => set("includeSummary", v)}
            label="Closing summary"
            hint="Attendance and assessment percentages against your configured thresholds."
          />
        </div>

        <div className="flex flex-col justify-end gap-2 pt-1 sm:flex-row">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={nothingSelected}
            loading={copyMutation.isPending}
            onClick={() => copyMutation.mutate()}
          >
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy as text"}
          </Button>
          <Button
            type="button"
            disabled={nothingSelected}
            loading={pdfMutation.isPending}
            onClick={() => pdfMutation.mutate()}
          >
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
