import { z } from "zod";

export const attendanceStatusEnum = z.enum(["PRESENT", "ABSENT"]);

export const attendanceRecordSchema = z.object({
  studentId: z.string().min(1),
  status: attendanceStatusEnum,
  remarks: z.string().max(500).optional().or(z.literal("")),
});

export const saveAttendanceSchema = z.object({
  moduleId: z.string().min(1, "Module is required"),
  date: z.string().min(1, "Date is required"),
  records: z.array(attendanceRecordSchema).min(1, "At least one attendance record is required"),
});

/** Corrects a saved session that went in against the wrong module, date or courses. */
export const moveAttendanceSchema = z.object({
  moduleId: z.string().min(1, "Module is required"),
  date: z.string().min(1, "Date is required"),
  courseIds: z.array(z.string()).optional(),
  targetModuleId: z.string().min(1, "Choose the module it should have been recorded against"),
  targetDate: z.string().min(1, "Choose the date it should have been recorded on"),
  targetCourseIds: z.array(z.string()).optional(),
});

export const deleteAttendanceSchema = z.object({
  moduleId: z.string().min(1, "Module is required"),
  date: z.string().min(1, "Date is required"),
  courseIds: z.array(z.string()).optional(),
});

export type SaveAttendanceInput = z.infer<typeof saveAttendanceSchema>;
export type MoveAttendanceInput = z.infer<typeof moveAttendanceSchema>;
export type DeleteAttendanceInput = z.infer<typeof deleteAttendanceSchema>;
