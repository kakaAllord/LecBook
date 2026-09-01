import { z } from "zod";

/**
 * A course is a name. A student enrols on it once, on arrival, and stays on it
 * until they leave — the level, semester and year a piece of teaching belongs
 * to are properties of the module that runs, not of the course.
 */
export const courseSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
});

export const courseUpdateSchema = courseSchema.partial();

export type CourseInput = z.infer<typeof courseSchema>;
export type CourseUpdateInput = z.infer<typeof courseUpdateSchema>;
