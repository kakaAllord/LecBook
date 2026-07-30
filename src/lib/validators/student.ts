import { z } from "zod";

export const studentSchema = z.object({
  registrationNumber: z.string().min(1, "Registration number is required").max(50),
  fullName: z.string().min(1, "Full name is required").max(200),
  gender: z.string().min(1, "Gender is required").max(30),
  phone: z.string().max(30).optional().or(z.literal("")),
  courseId: z.string().min(1, "Course is required"),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const studentUpdateSchema = studentSchema.partial();

export type StudentInput = z.infer<typeof studentSchema>;
export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;
