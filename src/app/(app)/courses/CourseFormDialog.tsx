"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { courseSchema, type CourseInput } from "@/lib/validators/course";
import { api, ApiClientError } from "@/lib/api-client";
import type { Course } from "@/types";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function CourseFormDialog({
  open,
  onClose,
  course,
}: {
  open: boolean;
  onClose: () => void;
  course?: Course | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(course);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CourseInput>({ resolver: zodResolver(courseSchema) });

  useEffect(() => {
    if (open) {
      reset(
        course
          ? { name: course.name, coreModuleCode: course.coreModule?.code ?? "" }
          : { name: "", coreModuleCode: "" }
      );
    }
  }, [open, course, reset]);

  const mutation = useMutation({
    mutationFn: (data: CourseInput) =>
      isEdit ? api.patch(`/api/courses/${course!.id}`, data) : api.post("/api/courses", data),
    onSuccess: () => {
      toast.success(isEdit ? "Course updated" : "Course created");
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["modules"] });
      queryClient.invalidateQueries({ queryKey: ["teaching-units"] });
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Something went wrong");
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Edit Course" : "New Course"}>
      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
        <div>
          <Label htmlFor="name">Course Name</Label>
          <Input id="name" placeholder="Electrical Engineering" error={errors.name?.message} {...register("name")} />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <Label htmlFor="coreModuleCode">Core Module Code (optional)</Label>
          <Input
            id="coreModuleCode"
            placeholder="EE100"
            error={errors.coreModuleCode?.message}
            {...register("coreModuleCode")}
          />
          <FieldError message={errors.coreModuleCode?.message} />
        </div>
        <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          A course is added once — no level. A student enrols on it once and moves up through Level I, II and III on
          it.{" "}
          {isEdit
            ? "Renaming the course renames its core module too; the code above is that module's."
            : "Its core module, with the same name and the code above, is created with it."}
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {isEdit ? "Save Changes" : "Create Course"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
