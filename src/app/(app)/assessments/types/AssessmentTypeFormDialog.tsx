"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { assessmentTypeSchema, type AssessmentTypeInput } from "@/lib/validators/assessment";
import { api, ApiClientError } from "@/lib/api-client";
import type { AssessmentType } from "@/types";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

export function AssessmentTypeFormDialog({
  open,
  onClose,
  assessmentType,
}: {
  open: boolean;
  onClose: () => void;
  assessmentType?: AssessmentType | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(assessmentType);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssessmentTypeInput>({ resolver: zodResolver(assessmentTypeSchema) });

  useEffect(() => {
    if (open) {
      reset(
        assessmentType
          ? {
              name: assessmentType.name,
              maxMarks: assessmentType.maxMarks,
              description: assessmentType.description ?? "",
            }
          : { name: "", maxMarks: 20, description: "" }
      );
    }
  }, [open, assessmentType, reset]);

  const mutation = useMutation({
    mutationFn: (data: AssessmentTypeInput) =>
      isEdit
        ? api.patch(`/api/assessment-types/${assessmentType!.id}`, data)
        : api.post("/api/assessment-types", data),
    onSuccess: () => {
      toast.success(isEdit ? "Assessment type updated" : "Assessment type created");
      queryClient.invalidateQueries({ queryKey: ["assessment-types"] });
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Something went wrong");
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Edit Assessment Type" : "New Assessment Type"}>
      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" placeholder="Quiz" error={errors.name?.message} {...register("name")} />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <Label htmlFor="maxMarks">Max Marks</Label>
          <Input
            id="maxMarks"
            type="number"
            step="0.5"
            min="0"
            error={errors.maxMarks?.message}
            {...register("maxMarks", { valueAsNumber: true })}
          />
          <FieldError message={errors.maxMarks?.message} />
        </div>
        <div>
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea id="description" rows={2} {...register("description")} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {isEdit ? "Save Changes" : "Create Type"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
