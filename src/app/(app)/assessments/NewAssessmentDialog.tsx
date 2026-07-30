"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { toast } from "sonner";
import { assessmentSchema, type AssessmentInput } from "@/lib/validators/assessment";
import { api, ApiClientError } from "@/lib/api-client";
import type { Assessment, AssessmentType, Course } from "@/types";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export function NewAssessmentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: courses } = useQuery({
    queryKey: ["courses", "all"],
    queryFn: () => api.get<Course[]>("/api/courses?all=true"),
    enabled: open,
  });
  const { data: types } = useQuery({
    queryKey: ["assessment-types"],
    queryFn: () => api.get<AssessmentType[]>("/api/assessment-types"),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssessmentInput>({ resolver: zodResolver(assessmentSchema) });

  useEffect(() => {
    if (open) {
      reset({ courseId: "", assessmentTypeId: "", title: "", date: dayjs().format("YYYY-MM-DD") });
    }
  }, [open, reset]);

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
          <Label htmlFor="courseId">Course</Label>
          <Select id="courseId" error={errors.courseId?.message} {...register("courseId")}>
            <option value="">Select a course...</option>
            {courses?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.level} · {c.semester}
              </option>
            ))}
          </Select>
          <FieldError message={errors.courseId?.message} />
        </div>
        <div>
          <Label htmlFor="assessmentTypeId">Assessment Type</Label>
          <Select id="assessmentTypeId" error={errors.assessmentTypeId?.message} {...register("assessmentTypeId")}>
            <option value="">Select a type...</option>
            {types?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} (max {t.maxMarks})
              </option>
            ))}
          </Select>
          <FieldError message={errors.assessmentTypeId?.message} />
        </div>
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" placeholder="Quiz 1" error={errors.title?.message} {...register("title")} />
          <FieldError message={errors.title?.message} />
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
