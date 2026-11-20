import { z } from "zod";
import { moduleCodeSchema } from "./module";

/**
 * A course is a name. A student enrols on it once, on arrival, and stays on it
 * until they leave — the level, semester and year a piece of teaching belongs
 * to are properties of the module that runs, not of the course.
 *
 * `coreModuleCode` belongs to the core module the course brings with it, not
 * to the course: it is taken here only so the code can be set in the same
 * step that creates that module.
 */
export const courseSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  coreModuleCode: moduleCodeSchema,
});

export const courseUpdateSchema = courseSchema.partial();

export type CourseInput = z.infer<typeof courseSchema>;
export type CourseUpdateInput = z.infer<typeof courseUpdateSchema>;
