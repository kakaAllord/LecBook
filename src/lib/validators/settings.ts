import { z } from "zod";

/** What an administrator owns: how the institution presents itself. */
export const institutionSettingsSchema = z.object({
  institutionName: z.string().min(1, "Institution name is required").max(200),
  institutionLogo: z
    .string()
    .regex(/^data:image\/(png|jpe?g|webp);base64,/, "Logo must be an uploaded image")
    .max(1_500_000, "Logo image is too large")
    .nullable()
    .optional(),
});

/**
 * What a lecturer owns: the bar their own students are measured against. These
 * live on the lecturer rather than the institution because the person who
 * teaches the module is the one who knows what counts as enough attendance or
 * a pass on it.
 */
export const teachingSettingsSchema = z.object({
  attendanceThreshold: z
    .number()
    .min(0, "Must be between 0 and 100")
    .max(100, "Must be between 0 and 100"),
  assessmentPassMark: z
    .number()
    .min(0, "Must be between 0 and 100")
    .max(100, "Must be between 0 and 100"),
});

export type InstitutionSettingsInput = z.infer<typeof institutionSettingsSchema>;
export type TeachingSettingsInput = z.infer<typeof teachingSettingsSchema>;
