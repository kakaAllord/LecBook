"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Plus, Trash2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import type { Assessment, Module } from "@/types";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { NewAssessmentDialog } from "./NewAssessmentDialog";

export default function AssessmentsPage() {
  const queryClient = useQueryClient();
  const [moduleId, setModuleId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Assessment | null>(null);

  const { data: modules } = useQuery({
    queryKey: ["modules", "all"],
    queryFn: () => api.get<Module[]>("/api/modules?all=true"),
  });

  const selectedModule = modules?.find((m) => m.id === moduleId);

  const { data, isLoading } = useQuery({
    queryKey: ["assessments", moduleId, courseId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (moduleId) params.set("moduleId", moduleId);
      if (courseId) params.set("courseId", courseId);
      return api.get<Assessment[]>(`/api/assessments?${params.toString()}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/assessments/${id}`),
    onSuccess: () => {
      toast.success("Assessment deleted");
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      setDeleting(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to delete assessment");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Assessments</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Create assessments and record marks for your students.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" /> New Assessment
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          value={moduleId}
          onChange={(e) => {
            setModuleId(e.target.value);
            setCourseId("");
          }}
          className="max-w-xs"
        >
          <option value="">All modules</option>
          {modules?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        <Select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="max-w-xs" disabled={!moduleId}>
          <option value="">All courses</option>
          {selectedModule?.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No assessments yet"
          description="Create an assessment to start recording marks."
          action={
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> New Assessment
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Module</TH>
              <TH>Courses</TH>
              <TH>Date</TH>
              <TH>Marks Entered</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {data.map((assessment) => (
              <TR key={assessment.id}>
                <TD>
                  <Link href={`/assessments/${assessment.id}`} className="font-medium text-indigo-600 hover:underline">
                    {assessment.name}
                  </Link>{" "}
                  <span className="text-xs text-slate-400">(max {assessment.maxMarks})</span>
                </TD>
                <TD>{assessment.module.name}</TD>
                <TD>{assessment.courses.map((c) => c.name).join(", ")}</TD>
                <TD>{dayjs(assessment.date).format("DD MMM YYYY")}</TD>
                <TD>{assessment._count?.marks ?? 0}</TD>
                <TD>
                  <div className="flex justify-end gap-1">
                    <Link href={`/assessments/${assessment.id}`}>
                      <Button variant="ghost" size="sm">
                        Enter Marks
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(assessment)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <NewAssessmentDialog open={formOpen} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        title="Delete assessment?"
        description={`This will permanently delete "${deleting?.name}" and all recorded marks.`}
      />
    </div>
  );
}
