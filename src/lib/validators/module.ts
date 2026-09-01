import { z } from "zod";

/**
 * A module is what actually runs in a term, so it is the module that says which
 * level, semester and year it belongs to, and which course or courses sit in it.
 */
export const moduleSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  code: z.string().max(50).optional(),
  level: z.string().min(1, "Level is required").max(50),
  semester: z.string().min(1, "Semester is required").max(50),
  academicYear: z.string().min(1, "Academic year is required").max(20),
  courseIds: z.array(z.string()).min(1, "Select at least one course"),
});

export const moduleUpdateSchema = moduleSchema.partial();

export type ModuleInput = z.infer<typeof moduleSchema>;
export type ModuleUpdateInput = z.infer<typeof moduleUpdateSchema>;
