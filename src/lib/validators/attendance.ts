import { z } from "zod";

export const attendanceStatusEnum = z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]);

export const attendanceRecordSchema = z.object({
  studentId: z.string().min(1),
  status: attendanceStatusEnum,
  remarks: z.string().max(500).optional().or(z.literal("")),
});

export const saveAttendanceSchema = z.object({
  courseId: z.string().min(1, "Course is required"),
  date: z.string().min(1, "Date is required"),
  records: z.array(attendanceRecordSchema).min(1, "At least one attendance record is required"),
});

export type SaveAttendanceInput = z.infer<typeof saveAttendanceSchema>;
