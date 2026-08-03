import { z } from "zod";

export const moduleSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  code: z.string().max(50).optional(),
  courseIds: z.array(z.string()).min(1, "Select at least one course"),
});

export const moduleUpdateSchema = moduleSchema.partial();

export type ModuleInput = z.infer<typeof moduleSchema>;
export type ModuleUpdateInput = z.infer<typeof moduleUpdateSchema>;
