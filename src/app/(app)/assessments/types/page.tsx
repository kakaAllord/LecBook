"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Pencil, Trash2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import type { AssessmentType } from "@/types";
import { Button } from "@/components/ui/Button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AssessmentTypeFormDialog } from "./AssessmentTypeFormDialog";

export default function AssessmentTypesPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AssessmentType | null>(null);
  const [deleting, setDeleting] = useState<AssessmentType | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["assessment-types"],
    queryFn: () => api.get<AssessmentType[]>("/api/assessment-types"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/assessment-types/${id}`),
    onSuccess: () => {
      toast.success("Assessment type deleted");
      queryClient.invalidateQueries({ queryKey: ["assessment-types"] });
      setDeleting(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Failed to delete assessment type");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/assessments" className="mb-2 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Assessments
        </Link>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Assessment Types</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Define the kinds of assessments you use, e.g. Quiz, Test, Assignment.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New Type
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No assessment types yet"
          description="Create types like Quiz, Test or Assignment before creating assessments."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> New Type
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Max Marks</TH>
              <TH>Description</TH>
              <TH>Assessments</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {data.map((type) => (
              <TR key={type.id}>
                <TD className="font-medium text-slate-900 dark:text-slate-100">{type.name}</TD>
                <TD>{type.maxMarks}</TD>
                <TD>{type.description || "-"}</TD>
                <TD>{type._count?.assessments ?? 0}</TD>
                <TD>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(type);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(type)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <AssessmentTypeFormDialog open={formOpen} onClose={() => setFormOpen(false)} assessmentType={editing} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        title="Delete assessment type?"
        description={`This will permanently delete "${deleting?.name}". Types used by existing assessments cannot be deleted.`}
      />
    </div>
  );
}
