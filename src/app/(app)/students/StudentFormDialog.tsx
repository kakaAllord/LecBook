"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { studentSchema, type StudentInput } from "@/lib/validators/student";
import { api, ApiClientError } from "@/lib/api-client";
import type { Course, Student } from "@/types";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export function StudentFormDialog({
  open,
  onClose,
  student,
  defaultCourseId,
}: {
  open: boolean;
  onClose: () => void;
  student?: Student | null;
  defaultCourseId?: string;
}) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(student);

  const { data: courses } = useQuery({
    queryKey: ["courses", "all"],
    queryFn: () => api.get<Course[]>("/api/courses?all=true"),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StudentInput>({ resolver: zodResolver(studentSchema) });

  useEffect(() => {
    if (open) {
      reset(
        student
          ? {
              registrationNumber: student.registrationNumber,
              fullName: student.fullName,
              gender: student.gender,
              phone: student.phone ?? "",
              courseId: student.courseId,
              status: student.status,
            }
          : {
              registrationNumber: "",
              fullName: "",
              gender: "",
              phone: "",
              courseId: defaultCourseId ?? "",
              status: "ACTIVE",
            }
      );
    }
  }, [open, student, defaultCourseId, reset]);

  const mutation = useMutation({
    mutationFn: (data: StudentInput) =>
      isEdit ? api.patch(`/api/students/${student!.id}`, data) : api.post("/api/students", data),
    onSuccess: () => {
      toast.success(isEdit ? "Student updated" : "Student registered");
      queryClient.invalidateQueries({ queryKey: ["students"] });
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Something went wrong");
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Edit Student" : "Register Student"}>
      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="registrationNumber">Registration Number</Label>
            <Input
              id="registrationNumber"
              placeholder="REG-0001"
              error={errors.registrationNumber?.message}
              {...register("registrationNumber")}
            />
            <FieldError message={errors.registrationNumber?.message} />
          </div>
          <div>
            <Label htmlFor="gender">Gender</Label>
            <Select id="gender" error={errors.gender?.message} {...register("gender")}>
              <option value="">Select...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </Select>
            <FieldError message={errors.gender?.message} />
          </div>
        </div>

        <div>
          <Label htmlFor="fullName">Full Name</Label>
          <Input id="fullName" placeholder="Jane Doe" error={errors.fullName?.message} {...register("fullName")} />
          <FieldError message={errors.fullName?.message} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" placeholder="0712345678" error={errors.phone?.message} {...register("phone")} />
            <FieldError message={errors.phone?.message} />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" {...register("status")}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </div>
        </div>

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

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {isEdit ? "Save Changes" : "Register Student"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
