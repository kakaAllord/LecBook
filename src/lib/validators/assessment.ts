import { z } from "zod";

/** What a new assessment is marked out of unless the lecturer says otherwise. */
export const DEFAULT_MAX_MARKS = 100;

export const assessmentSchema = z.object({
  moduleId: z.string().min(1, "Module is required"),
  courseIds: z.array(z.string()).min(1, "Select at least one course"),
  name: z.string().min(1, "Assessment type/name is required").max(200),
  // Each assessment stands on its own total; the only bound is one that catches
  // a slipped keystroke, not a share of some module-wide allowance.
  maxMarks: z.coerce
    .number()
    .positive("Marks must be greater than 0")
    .max(1000, "Marks must be 1000 or less"),
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

export type AssessmentInput = z.infer<typeof assessmentSchema>;
export type AssessmentFormInput = z.input<typeof assessmentSchema>;
export type SaveMarksInput = z.infer<typeof saveMarksSchema>;
