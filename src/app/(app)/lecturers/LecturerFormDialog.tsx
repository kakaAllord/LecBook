"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createUserSchema, type CreateUserInput } from "@/lib/validators/user";
import { api, ApiClientError } from "@/lib/api-client";
import type { Course, ManagedUser, Module } from "@/types";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  TeachingAssignmentsEditor,
  newRow,
  rowsFromTeaching,
  rowsProblem,
  rowsToAssignments,
  type AssignmentRow,
} from "./TeachingAssignmentsEditor";

/**
 * The administrator fills in everything about the lecturer here — the account
 * is complete before it is handed over. All the lecturer does with the invite
 * link is choose a password.
 */
export function LecturerFormDialog({
  open,
  onClose,
  lecturer,
  onInviteCreated,
}: {
  open: boolean;
  onClose: () => void;
  lecturer?: ManagedUser | null;
  onInviteCreated: (lecturer: ManagedUser, inviteUrl: string) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(lecturer);

  const { data: modules } = useQuery({
    queryKey: ["modules", "all"],
    queryFn: () => api.get<Module[]>("/api/modules?all=true"),
    enabled: open,
  });
  const { data: courses } = useQuery({
    queryKey: ["courses", "all"],
    queryFn: () => api.get<Course[]>("/api/courses?all=true"),
    enabled: open,
  });

  // What they teach is edited outside react-hook-form: each line's level and
  // course choices depend on the module picked on that line.
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [rowsError, setRowsError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserInput>({ resolver: zodResolver(createUserSchema) });

  useEffect(() => {
    if (!open) return;
    reset(
      lecturer
        ? {
            name: lecturer.name,
            email: lecturer.email,
            role: "LECTURER",
            title: lecturer.title ?? "",
            phone: lecturer.phone ?? "",
            staffId: lecturer.staffId ?? "",
          }
        : {
            name: "",
            email: "",
            role: "LECTURER",
            title: "",
            phone: "",
            staffId: "",
          }
    );
  }, [open, lecturer, reset]);

  // The teaching lines are reset while rendering whenever the dialog opens for
  // a different person, the way React suggests for state derived from props.
  const openedFor = open ? (lecturer?.id ?? "new") : null;
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (openedFor !== loadedFor) {
    setLoadedFor(openedFor);
    if (openedFor) {
      setRows(lecturer ? rowsFromTeaching(lecturer.teaching) : [newRow()]);
      setRowsError(null);
    }
  }

  function submit(data: CreateUserInput) {
    const problem = rowsProblem(rows, modules ?? []);
    if (problem) {
      setRowsError(problem);
      return;
    }
    setRowsError(null);
    const payload = { ...data, assignments: rowsToAssignments(rows) };
    if (isEdit) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  }

  const onError = (error: unknown) => {
    toast.error(error instanceof ApiClientError ? error.message : "Something went wrong");
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateUserInput) =>
      api.post<{ user: ManagedUser; inviteUrl: string }>("/api/admin/users", data),
    onSuccess: ({ user: created, inviteUrl }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["modules"] });
      onInviteCreated(created, inviteUrl);
      onClose();
    },
    onError,
  });

  const updateMutation = useMutation({
    mutationFn: (data: CreateUserInput) =>
      api.patch<ManagedUser>(`/api/admin/users/${lecturer!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["modules"] });
      toast.success("Lecturer updated");
      onClose();
    },
    onError,
  });

  const submitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? `Edit ${lecturer?.name}` : "Add a lecturer"}
    >
      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        {!isEdit && (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            Enter their details, then each module they teach with the level and courses they teach it to.
            You will get a one-time link to send them; opening it, they set a password and their students are
            already waiting.
          </p>
        )}

        <input type="hidden" value="LECTURER" {...register("role")} />

        <div className="grid gap-4 sm:grid-cols-[110px_1fr]">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="Dr." {...register("title")} />
          </div>
          <div>
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" placeholder="Jane Doe" error={errors.name?.message} {...register("name")} />
            <FieldError message={errors.name?.message} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="jane@college.edu"
              error={errors.email?.message}
              {...register("email")}
            />
            <FieldError message={errors.email?.message} />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" placeholder="0712345678" {...register("phone")} />
          </div>
          <div>
            <Label htmlFor="staffId">Staff ID</Label>
            <Input id="staffId" placeholder="Optional" {...register("staffId")} />
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <Label>What they teach</Label>
          <TeachingAssignmentsEditor
            rows={rows}
            onChange={(next) => {
              setRows(next);
              setRowsError(null);
            }}
            modules={modules ?? []}
            courses={courses ?? []}
          />
          {rowsError && <FieldError message={rowsError} />}
          <p className="mt-2 text-xs text-slate-400">
            Their students are the active students at each chosen level on each chosen course. Nothing else
            puts a student in front of them.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {isEdit ? "Save changes" : "Create account & get invite link"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
