"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createUserSchema, type CreateUserInput } from "@/lib/validators/user";
import { api, ApiClientError } from "@/lib/api-client";
import type { Course, ManagedUser, Module, UserRole } from "@/types";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { CheckboxGroup } from "@/components/ui/CheckboxGroup";

export function UserFormDialog({
  open,
  onClose,
  user,
  viewerRole,
  onInviteCreated,
}: {
  open: boolean;
  onClose: () => void;
  user?: ManagedUser | null;
  viewerRole: UserRole;
  onInviteCreated: (user: ManagedUser, inviteUrl: string) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(user);
  const [role, setRole] = useState<UserRole>("LECTURER");

  const { data: courses } = useQuery({
    queryKey: ["courses", "all"],
    queryFn: () => api.get<Course[]>("/api/courses?all=true"),
    enabled: open,
  });

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
    const initial: CreateUserInput = user
      ? {
          name: user.name,
          email: user.email,
          role: user.role,
          title: user.title ?? "",
          phone: user.phone ?? "",
          staffId: user.staffId ?? "",
          courseIds: user.courses.map((c) => c.id),
          moduleIds: user.modules.map((m) => m.id),
        }
      : {
          name: "",
          email: "",
          role: "LECTURER",
          title: "",
          phone: "",
          staffId: "",
          courseIds: [],
          moduleIds: [],
        };
    reset(initial);
    setRole(initial.role);
  }, [open, user, reset]);

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
      api.patch<ManagedUser>(`/api/admin/users/${user!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Account updated");
      onClose();
    },
    onError,
  });

  const submitting = createMutation.isPending || updateMutation.isPending;

  const isLecturer = role === "LECTURER";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? `Edit ${user?.name}` : "Add a person"}
    >
      <form
        onSubmit={handleSubmit((data) =>
          isEdit ? updateMutation.mutate(data) : createMutation.mutate(data)
        )}
        className="space-y-4"
      >
        {!isEdit && (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            You add the account and assign the courses. They receive a one-time link, fill in the rest of
            their details, set their own password, and start using the system.
          </p>
        )}

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

        <div className="grid gap-4 sm:grid-cols-2">
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
            <Label htmlFor="role">Role</Label>
            <Select
              id="role"
              error={errors.role?.message}
              {...register("role", { onChange: (e) => setRole(e.target.value as UserRole) })}
            >
              <option value="LECTURER">Lecturer</option>
              {viewerRole === "SUPER_ADMIN" && <option value="ADMIN">Administrator</option>}
            </Select>
            <FieldError message={errors.role?.message} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" placeholder="0712345678" {...register("phone")} />
          </div>
          <div>
            <Label htmlFor="staffId">Staff ID</Label>
            <Input id="staffId" placeholder="Optional" {...register("staffId")} />
          </div>
        </div>

        {isLecturer && (
          <div className="grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2 dark:border-slate-800">
            <div>
              <Label htmlFor="courseIds">Courses they teach</Label>
              <Controller
                name="courseIds"
                control={control}
                render={({ field }) => (
                  <CheckboxGroup
                    options={(courses ?? []).map((c) => ({
                      id: c.id,
                      label: `${c.name} · ${c.level} · ${c.semester}`,
                    }))}
                    value={field.value ?? []}
                    onChange={field.onChange}
                  />
                )}
              />
              <p className="mt-1 text-xs text-slate-400">
                Every student in these courses appears in their account automatically.
              </p>
            </div>
            <div>
              <Label htmlFor="moduleIds">Modules (optional)</Label>
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
                Leave empty to give them every module linked to their courses.
              </p>
            </div>
          </div>
        )}

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
