"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { ArrowLeft, Save, Download } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import type { AssessmentDetail } from "@/types";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent } from "@/components/ui/Card";

type DraftMark = { marks: string; remarks: string };

export function MarksBoard() {
  const params = useParams<{ id: string }>();
  const assessmentId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [drafts, setDrafts] = useState<Record<string, DraftMark>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [syncedData, setSyncedData] = useState<AssessmentDetail | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["assessment", assessmentId],
    queryFn: () => api.get<AssessmentDetail>(`/api/assessments/${assessmentId}`),
  });

  if (data && data !== syncedData) {
    setSyncedData(data);
    const next: Record<string, DraftMark> = {};
    for (const entry of data.students) {
      next[entry.student.id] = {
        marks: entry.mark ? String(entry.mark.marks) : "",
        remarks: entry.mark?.remarks ?? "",
      };
    }
    setDrafts(next);
  }

  const maxMarks = data?.assessment.maxMarks ?? 0;

  const stats = useMemo(() => {
    const values = Object.values(drafts)
      .map((d) => parseFloat(d.marks))
      .filter((v) => !Number.isNaN(v));
    if (values.length === 0) return null;
    return {
      average: values.reduce((a, b) => a + b, 0) / values.length,
      highest: Math.max(...values),
      lowest: Math.min(...values),
      count: values.length,
    };
  }, [drafts]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/api/assessments/${assessmentId}/marks`, {
        marks: Object.entries(drafts)
          .filter(([, d]) => d.marks !== "")
          .map(([studentId, d]) => ({
            studentId,
            marks: Number(d.marks),
            remarks: d.remarks,
          })),
      }),
    onSuccess: () => {
      toast.success("Marks saved");
      queryClient.invalidateQueries({ queryKey: ["assessment", assessmentId] });
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to save marks");
    },
  });

  function updateMark(studentId: string, marks: string) {
    setDrafts((prev) => ({ ...prev, [studentId]: { ...prev[studentId], marks } }));
    const numeric = parseFloat(marks);
    if (marks !== "" && (Number.isNaN(numeric) || numeric < 0 || numeric > maxMarks)) {
      setFieldErrors((prev) => ({ ...prev, [studentId]: `0 - ${maxMarks} only` }));
    } else {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    }
  }

  if (isLoading) return <LoadingSpinner />;
  if (error || !data) {
    return (
      <EmptyState
        title="Assessment not found"
        description="It may have been deleted."
        action={
          <Button variant="outline" onClick={() => router.push("/assessments")}>
            Back to Assessments
          </Button>
        }
      />
    );
  }

  const hasErrors = Object.keys(fieldErrors).length > 0;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/assessments" className="mb-2 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Assessments
        </Link>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{data.assessment.name}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {data.assessment.module.name} · {data.assessment.courses.map((c) => c.name).join(", ")} ·{" "}
              {dayjs(data.assessment.date).format("DD MMM YYYY")} · Max {maxMarks} marks
            </p>
          </div>
          <a href={`/api/reports/assessment?assessmentId=${assessmentId}`} target="_blank" rel="noreferrer">
            <Button variant="outline">
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          </a>
        </div>
      </div>

      {stats && (
        <Card>
          <CardContent className="flex flex-wrap gap-6 py-4 text-sm">
            <div>
              <p className="text-slate-500 dark:text-slate-400">Entered</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{stats.count}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Average</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{stats.average.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Highest</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{stats.highest}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Lowest</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{stats.lowest}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {data.students.length === 0 ? (
        <EmptyState title="No active students" description="These courses have no active students to record marks for." />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Reg. No</TH>
                <TH>Name</TH>
                <TH>{`Marks (/${maxMarks})`}</TH>
                <TH>Remarks</TH>
              </TR>
            </THead>
            <TBody>
              {data.students.map(({ student }) => {
                const draft = drafts[student.id] ?? { marks: "", remarks: "" };
                return (
                  <TR key={student.id}>
                    <TD className="font-medium text-slate-900 dark:text-slate-100">{student.registrationNumber}</TD>
                    <TD>{student.fullName}</TD>
                    <TD>
                      <Input
                        type="number"
                        step="0.5"
                        min={0}
                        max={maxMarks}
                        value={draft.marks}
                        onChange={(e) => updateMark(student.id, e.target.value)}
                        error={fieldErrors[student.id]}
                        className="w-24"
                      />
                      {fieldErrors[student.id] && <p className="mt-1 text-xs text-red-500">{fieldErrors[student.id]}</p>}
                    </TD>
                    <TD>
                      <Input
                        value={draft.remarks}
                        placeholder="Optional"
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [student.id]: { ...draft, remarks: e.target.value } }))
                        }
                        className="min-w-[160px]"
                      />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>

          <div className="flex justify-end">
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} disabled={hasErrors}>
              <Save className="h-4 w-4" /> Save Marks
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
