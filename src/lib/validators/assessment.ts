import { z } from "zod";

export const assessmentTypeSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  maxMarks: z.number().positive("Max marks must be greater than 0"),
  description: z.string().max(500).optional().or(z.literal("")),
});
export const assessmentTypeUpdateSchema = assessmentTypeSchema.partial();

export const assessmentSchema = z.object({
  courseId: z.string().min(1, "Course is required"),
  assessmentTypeId: z.string().min(1, "Assessment type is required"),
  title: z.string().min(1, "Title is required").max(200),
  date: z.string().min(1, "Date is required"),
});

export const markEntrySchema = z.object({
  studentId: z.string().min(1),
  marks: z.coerce.number().min(0, "Marks cannot be negative"),
  remarks: z.string().max(500).optional().or(z.literal("")),
});

export const saveMarksSchema = z.object({
  marks: z.array(markEntrySchema).min(1, "At least one mark entry is required"),
});

export type AssessmentTypeInput = z.infer<typeof assessmentTypeSchema>;
export type AssessmentTypeUpdateInput = z.infer<typeof assessmentTypeUpdateSchema>;
export type AssessmentInput = z.infer<typeof assessmentSchema>;
export type SaveMarksInput = z.infer<typeof saveMarksSchema>;
