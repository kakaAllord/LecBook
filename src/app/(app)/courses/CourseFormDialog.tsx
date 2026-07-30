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
          ? { name: course.name, level: course.level, semester: course.semester, academicYear: course.academicYear }
          : { name: "", level: "", semester: "", academicYear: "" }
      );
    }
  }, [open, course, reset]);

  const mutation = useMutation({
    mutationFn: (data: CourseInput) =>
      isEdit ? api.patch(`/api/courses/${course!.id}`, data) : api.post("/api/courses", data),
    onSuccess: () => {
      toast.success(isEdit ? "Course updated" : "Course created");
      queryClient.invalidateQueries({ queryKey: ["courses"] });
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
