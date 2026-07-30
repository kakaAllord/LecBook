"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Plus, Trash2, Settings, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import type { Assessment, Course } from "@/types";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { NewAssessmentDialog } from "./NewAssessmentDialog";

export default function AssessmentsPage() {
  const queryClient = useQueryClient();
  const [courseId, setCourseId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Assessment | null>(null);

  const { data: courses } = useQuery({
    queryKey: ["courses", "all"],
    queryFn: () => api.get<Course[]>("/api/courses?all=true"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["assessments", courseId],
    queryFn: () => api.get<Assessment[]>(`/api/assessments${courseId ? `?courseId=${courseId}` : ""}`),
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
        <div className="flex gap-2">
          <Link href="/assessments/types">
            <Button variant="outline">
              <Settings className="h-4 w-4" /> Assessment Types
            </Button>
          </Link>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> New Assessment
          </Button>
        </div>
      </div>

      <Select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="max-w-xs">
        <option value="">All courses</option>
        {courses?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>

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
              <TH>Title</TH>
              <TH>Type</TH>
              <TH>Course</TH>
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
                    {assessment.title}
                  </Link>
                </TD>
                <TD>{assessment.assessmentType.name} (max {assessment.assessmentType.maxMarks})</TD>
                <TD>{assessment.course.name}</TD>
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
        description={`This will permanently delete "${deleting?.title}" and all recorded marks.`}
      />
    </div>
  );
}
