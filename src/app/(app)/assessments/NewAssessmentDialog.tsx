"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { toast } from "sonner";
import {
  assessmentSchema,
  DEFAULT_MAX_MARKS,
  type AssessmentInput,
  type AssessmentFormInput,
} from "@/lib/validators/assessment";
import { api, ApiClientError } from "@/lib/api-client";
import type { Assessment, Module } from "@/types";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { CheckboxGroup } from "@/components/ui/CheckboxGroup";
import { Button } from "@/components/ui/Button";

export function NewAssessmentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [moduleId, setModuleId] = useState("");

  const { data: modules } = useQuery({
    queryKey: ["modules", "all"],
    queryFn: () => api.get<Module[]>("/api/modules?all=true"),
    enabled: open,
  });

  const selectedModule = modules?.find((m) => m.id === moduleId);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AssessmentFormInput, unknown, AssessmentInput>({ resolver: zodResolver(assessmentSchema) });

  useEffect(() => {
    if (open) {
      setModuleId("");
      reset({
        moduleId: "",
        courseIds: [],
        name: "",
        maxMarks: DEFAULT_MAX_MARKS,
        date: dayjs().format("YYYY-MM-DD"),
      });
    }
  }, [open, reset]);

  const watchedModuleId = watch("moduleId");
  useEffect(() => {
    setModuleId(watchedModuleId || "");
    setValue("courseIds", []);
  }, [watchedModuleId, setValue]);

  const mutation = useMutation({
    mutationFn: (data: AssessmentInput) => api.post<Assessment>("/api/assessments", data),
    onSuccess: (assessment) => {
      toast.success("Assessment created");
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      onClose();
      router.push(`/assessments/${assessment.id}`);
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Something went wrong");
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title="New Assessment">
      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
        <div>
          <Label htmlFor="moduleId">Module</Label>
          <Select id="moduleId" error={errors.moduleId?.message} {...register("moduleId")}>
            <option value="">Select a module...</option>
            {modules?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
          <FieldError message={errors.moduleId?.message} />
        </div>

        <div>
          <Label htmlFor="courseIds">Courses</Label>
          <Controller
            control={control}
            name="courseIds"
            render={({ field }) => (
              <CheckboxGroup
                options={(selectedModule?.courses ?? []).map((c) => ({
                  id: c.id,
                  label: c.name,
                }))}
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
          <FieldError message={errors.courseIds?.message} />
        </div>

        <div>
          <Label htmlFor="name">Assessment Type / Name</Label>
          <Input id="name" placeholder="Quiz 1" error={errors.name?.message} {...register("name")} />
          <FieldError message={errors.name?.message} />
        </div>

        <div>
          <Label htmlFor="maxMarks">Marked out of</Label>
          <Input
            id="maxMarks"
            type="number"
            step="0.5"
            min={0}
            max={1000}
            placeholder={String(DEFAULT_MAX_MARKS)}
            error={errors.maxMarks?.message}
            {...register("maxMarks")}
          />
          <FieldError message={errors.maxMarks?.message} />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            This assessment stands on its own total. A student&apos;s result for the module is the average of
            the percentages they score across all of its assessments.
          </p>
        </div>

        <div>
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" error={errors.date?.message} {...register("date")} />
          <FieldError message={errors.date?.message} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Create & Enter Marks
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
