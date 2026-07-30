import { z } from "zod";

export const settingsSchema = z.object({
  institutionName: z.string().min(1, "Institution name is required").max(200),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
