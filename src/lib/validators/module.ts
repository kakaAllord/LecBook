import { z } from "zod";

/** Level I, II or III, sent as 1, 2 or 3. Query strings go through `parseLevelParam`. */
export const levelSchema = z
  .number({ message: "Choose a level" })
  .int()
  .min(1, "Choose Level I, II or III")
  .max(3, "Choose Level I, II or III");

/** Reads a level from a query string; undefined when absent or not 1–3. */
export function parseLevelParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const level = Number(value);
  return Number.isInteger(level) && level >= 1 && level <= 3 ? level : undefined;
}

/**
 * Only related modules are created by hand: a core module comes into being
 * with its course and carries the course's name. A related module belongs to
 * one level and is taught to every course at that level.
 */
export const moduleSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  code: z.string().max(50).optional(),
  level: levelSchema,
});

/**
 * A core module's name follows its course, so for one of those only the code
 * is taken from this; the service ignores the rest.
 */
export const moduleUpdateSchema = moduleSchema.partial();

export type ModuleInput = z.infer<typeof moduleSchema>;
export type ModuleUpdateInput = z.infer<typeof moduleUpdateSchema>;
