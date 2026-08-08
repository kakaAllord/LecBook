import { z } from "zod";

/**
 * Everything the student-record export can be narrowed by. Every section is
 * opt-in and every module/date filter is optional, so the same endpoint serves
 * "just this term's attendance for one module" and "absolutely everything".
 */
export const studentExportSchema = z.object({
  includeProfile: z.boolean(),
  includeSummary: z.boolean(),

  includeAttendance: z.boolean(),
  /** Empty means every module the student has attendance in. */
  attendanceModuleIds: z.array(z.string()).optional(),
  attendanceFrom: z.string().optional().or(z.literal("")),
  attendanceTo: z.string().optional().or(z.literal("")),
  /** "summary" is one row per module; "full" also lists every dated record. */
  attendanceDetail: z.enum(["summary", "full"]),

  includeAssessments: z.boolean(),
  /** Empty means every module the student has marks in. */
  assessmentModuleIds: z.array(z.string()).optional(),
  includeMissingMarks: z.boolean(),
});

export type StudentExportInput = z.infer<typeof studentExportSchema>;
