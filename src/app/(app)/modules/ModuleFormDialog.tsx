"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { moduleSchema, type ModuleInput } from "@/lib/validators/module";
import { api, ApiClientError } from "@/lib/api-client";
import type { Course, Module } from "@/types";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { CheckboxGroup } from "@/components/ui/CheckboxGroup";
import { Button } from "@/components/ui/Button";

export function ModuleFormDialog({
  open,
  onClose,
  module,
}: {
  open: boolean;
  onClose: () => void;
  module?: Module | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(module);

  const { data: courses } = useQuery({
    queryKey: ["courses", "all"],
    queryFn: () => api.get<Course[]>("/api/courses?all=true"),
    enabled: open,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ModuleInput>({ resolver: zodResolver(moduleSchema) });

  useEffect(() => {
    if (open) {
      reset(
        module
          ? {
              name: module.name,
              code: module.code ?? "",
              level: module.level ?? "",
              semester: module.semester ?? "",
              academicYear: module.academicYear ?? "",
              courseIds: module.courses.map((c) => c.id),
            }
          : { name: "", code: "", level: "", semester: "", academicYear: "", courseIds: [] }
      );
    }
  }, [open, module, reset]);

  const mutation = useMutation({
    mutationFn: (data: ModuleInput) =>
      isEdit ? api.patch(`/api/modules/${module!.id}`, data) : api.post("/api/modules", data),
    onSuccess: () => {
      toast.success(isEdit ? "Module updated" : "Module created");
      queryClient.invalidateQueries({ queryKey: ["modules"] });
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Something went wrong");
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Edit Module" : "New Module"}>
      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
        <div>
          <Label htmlFor="name">Module Name</Label>
          <Input id="name" placeholder="Database Systems" error={errors.name?.message} {...register("name")} />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <Label htmlFor="code">Code (optional)</Label>
          <Input id="code" placeholder="CS201" error={errors.code?.message} {...register("code")} />
          <FieldError message={errors.code?.message} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="level">Level</Label>
            <Input id="level" placeholder="Level 5" error={errors.level?.message} {...register("level")} />
            <FieldError message={errors.level?.message} />
          </div>
          <div>
            <Label htmlFor="semester">Semester</Label>
            <Input id="semester" placeholder="Semester II" error={errors.semester?.message} {...register("semester")} />
            <FieldError message={errors.semester?.message} />
          </div>
        </div>
        <div>
          <Label htmlFor="academicYear">Academic Year</Label>
          <Input id="academicYear" placeholder="2026" error={errors.academicYear?.message} {...register("academicYear")} />
          <FieldError message={errors.academicYear?.message} />
        </div>
        <div>
          <Label htmlFor="courseIds">Courses</Label>
          <Controller
            control={control}
            name="courseIds"
            render={({ field }) => (
              <CheckboxGroup
                options={(courses ?? []).map((c) => ({ id: c.id, label: c.name }))}
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
          <FieldError message={errors.courseIds?.message} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {isEdit ? "Save Changes" : "Create Module"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
