import { z } from "zod";
import { levelSchema } from "@/lib/validators/module";

export const studentSchema = z.object({
  registrationNumber: z.string().min(1, "Registration number is required").max(50),
  fullName: z.string().min(1, "Full name is required").max(200),
  gender: z.string().min(1, "Gender is required").max(30),
  phone: z.string().max(30).optional().or(z.literal("")),
  courseId: z.string().min(1, "Course is required"),
  // A newly registered student starts at Level I unless they join further on.
  level: levelSchema,
  status: z.enum(["ACTIVE", "INACTIVE", "COMPLETED"]),
});

export const studentUpdateSchema = studentSchema.partial();

/** Moves a chosen set of students to one level — for correcting levels in bulk. */
export const setLevelSchema = z.object({
  studentIds: z.array(z.string()).min(1, "Select at least one student"),
  level: levelSchema,
});

/**
 * Promotes the chosen students at one level: up a level, or to Completed from
 * Level III. The level is stated so a stale screen cannot promote a student
 * twice.
 */
export const promoteSchema = z.object({
  fromLevel: levelSchema,
  studentIds: z.array(z.string()).min(1, "Select at least one student to promote"),
});

export type StudentInput = z.infer<typeof studentSchema>;
export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;
export type SetLevelInput = z.infer<typeof setLevelSchema>;
export type PromoteInput = z.infer<typeof promoteSchema>;
