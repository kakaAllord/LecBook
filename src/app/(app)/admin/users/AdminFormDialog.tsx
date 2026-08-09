"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createUserSchema, type CreateUserInput } from "@/lib/validators/user";
import { api, ApiClientError } from "@/lib/api-client";
import type { ManagedUser } from "@/types";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

/**
 * Creating an administrator is the one account the super admin authors, and the
 * only way a new institution gets started: everything after this — courses,
 * students, lecturers — is that administrator's own work.
 */
export function AdminFormDialog({
  open,
  onClose,
  onInviteCreated,
}: {
  open: boolean;
  onClose: () => void;
  onInviteCreated: (admin: ManagedUser, inviteUrl: string) => void;
}) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserInput>({ resolver: zodResolver(createUserSchema) });

  useEffect(() => {
    if (!open) return;
    reset({
      name: "",
      email: "",
      role: "ADMIN",
      title: "",
      phone: "",
      staffId: "",
      moduleIds: [],
    });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (data: CreateUserInput) =>
      api.post<{ user: ManagedUser; inviteUrl: string }>("/api/admin/users", data),
    onSuccess: ({ user, inviteUrl }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      onInviteCreated(user, inviteUrl);
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Something went wrong");
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title="Add an administrator">
      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          They will run the institution&apos;s records: courses, modules, students and lecturers. You
          will get a one-time link to send them; opening it, they choose their own password.
        </p>

        <input type="hidden" value="ADMIN" {...register("role")} />

        <div className="grid gap-4 sm:grid-cols-[110px_1fr]">
          <div>
            <Label htmlFor="admin-title">Title</Label>
            <Input id="admin-title" placeholder="Mrs." {...register("title")} />
          </div>
          <div>
            <Label htmlFor="admin-name">Full Name</Label>
            <Input
              id="admin-name"
              placeholder="Jane Doe"
              error={errors.name?.message}
              {...register("name")}
            />
            <FieldError message={errors.name?.message} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              type="email"
              placeholder="registrar@college.edu"
              error={errors.email?.message}
              {...register("email")}
            />
            <FieldError message={errors.email?.message} />
          </div>
          <div>
            <Label htmlFor="admin-phone">Phone</Label>
            <Input id="admin-phone" placeholder="0712345678" {...register("phone")} />
          </div>
          <div>
            <Label htmlFor="admin-staffId">Staff ID</Label>
            <Input id="admin-staffId" placeholder="Optional" {...register("staffId")} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Create account &amp; get invite link
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
