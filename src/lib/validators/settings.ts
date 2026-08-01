import { z } from "zod";

export const settingsSchema = z.object({
  institutionName: z.string().min(1, "Institution name is required").max(200),
  institutionLogo: z
    .string()
    .regex(/^data:image\/(png|jpe?g|webp);base64,/, "Logo must be an uploaded image")
    .max(1_500_000, "Logo image is too large")
    .nullable()
    .optional(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
