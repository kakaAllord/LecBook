"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { moduleSchema, type ModuleInput } from "@/lib/validators/module";
import { api, ApiClientError } from "@/lib/api-client";
import type { Module } from "@/types";
import { LEVELS, levelLabel } from "@/lib/levels";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

/**
 * Creates and edits related modules — the ones that belong to a level and are
 * taught to every course at it. A core module is made with its course and
 * named after it, so for one of those only the code can be changed here.
 */
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
  const isCore = module?.kind === "CORE";

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
          ? { name: module.name, code: module.code ?? "", level: module.level ?? 1 }
          : { name: "", code: "", level: 1 }
      );
    }
  }, [open, module, reset]);

  const mutation = useMutation({
    mutationFn: (data: ModuleInput) =>
      isEdit
        ? api.patch(`/api/modules/${module!.id}`, isCore ? { code: data.code } : data)
        : api.post("/api/modules", data),
    onSuccess: () => {
      toast.success(isEdit ? "Module updated" : "Module created");
      queryClient.invalidateQueries({ queryKey: ["modules"] });
      queryClient.invalidateQueries({ queryKey: ["teaching-units"] });
      // The Courses list shows each core module's code.
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Something went wrong");
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isCore ? "Edit Core Module" : isEdit ? "Edit Related Module" : "New Related Module"}
    >
      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
        {isCore ? (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            <strong>{module?.name}</strong> is the core module of the {module?.course?.name} course. It is taught
            to that course at Level I, II and III and always carries the course&apos;s name — rename the course to
            rename it. Only its code can be changed here.
          </p>
        ) : (
          !isEdit && (
            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              A related module belongs to one level and is taught to every course at that level. Core modules
              are not created here: each course gets its own when the course is added.
            </p>
          )
        )}

        {/* Hidden fields keep a core module's name and level in the form so validation passes. */}
        <div className={isCore ? "hidden" : undefined}>
          <Label htmlFor="name">Module Name</Label>
          <Input id="name" placeholder="Communication Skills" error={errors.name?.message} {...register("name")} />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <Label htmlFor="code">Code (optional)</Label>
          <Input id="code" placeholder="CS101" error={errors.code?.message} {...register("code")} />
          <FieldError message={errors.code?.message} />
        </div>
        <div className={isCore ? "hidden" : undefined}>
          <Label htmlFor="level">Level</Label>
          <Controller
            control={control}
            name="level"
            render={({ field }) => (
              <Select
                id="level"
                value={String(field.value ?? 1)}
                onChange={(e) => field.onChange(Number(e.target.value))}
                error={errors.level?.message}
              >
                {LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {levelLabel(level)}
                  </option>
                ))}
              </Select>
            )}
          />
          <p className="mt-1 text-xs text-slate-400">Every course at this level takes it.</p>
          <FieldError message={errors.level?.message} />
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
