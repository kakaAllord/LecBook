import { z } from "zod";

export const courseSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  level: z.string().min(1, "Level is required").max(50),
  semester: z.string().min(1, "Semester is required").max(50),
  academicYear: z.string().min(1, "Academic year is required").max(20),
});

export const courseUpdateSchema = courseSchema.partial();

export type CourseInput = z.infer<typeof courseSchema>;
export type CourseUpdateInput = z.infer<typeof courseUpdateSchema>;
