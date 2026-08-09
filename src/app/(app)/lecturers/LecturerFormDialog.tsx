"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createUserSchema, type CreateUserInput } from "@/lib/validators/user";
import { api, ApiClientError } from "@/lib/api-client";
import type { ManagedUser, Module } from "@/types";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CheckboxGroup } from "@/components/ui/CheckboxGroup";

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

  const {
    register,
    handleSubmit,
    control,
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
            moduleIds: lecturer.modules.map((m) => m.id),
          }
        : {
            name: "",
            email: "",
            role: "LECTURER",
            title: "",
            phone: "",
            staffId: "",
            moduleIds: [],
          }
    );
  }, [open, lecturer, reset]);

  const onError = (error: unknown) => {
    toast.error(error instanceof ApiClientError ? error.message : "Something went wrong");
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateUserInput) =>
      api.post<{ user: ManagedUser; inviteUrl: string }>("/api/admin/users", data),
    onSuccess: ({ user: created, inviteUrl }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
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
      <form
        onSubmit={handleSubmit((data) =>
          isEdit ? updateMutation.mutate(data) : createMutation.mutate(data)
        )}
        className="space-y-4"
      >
        {!isEdit && (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            Enter their details and tick the modules they teach. You will get a one-time link to send
            them; opening it, they set a password and their students are already waiting.
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
          <Label htmlFor="moduleIds">Modules they teach</Label>
          <Controller
            name="moduleIds"
            control={control}
            render={({ field }) => (
              <CheckboxGroup
                options={(modules ?? []).map((m) => ({
                  id: m.id,
                  label: m.code ? `${m.name} (${m.code})` : m.name,
                }))}
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
          <p className="mt-1 text-xs text-slate-400">
            Every student on a course that runs these modules appears in their account automatically.
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
