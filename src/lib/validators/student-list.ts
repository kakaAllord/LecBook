import { z } from "zod";

export const STUDENT_LIST_STATUSES = ["ALL", "ACTIVE", "INACTIVE", "COMPLETED"] as const;
export type StudentListStatus = (typeof STUDENT_LIST_STATUSES)[number];

export const STUDENT_LIST_STATUS_LABELS: Record<StudentListStatus, string> = {
  ALL: "All statuses",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  COMPLETED: "Completed",
};

/**
 * What the student list can be narrowed by. Every filter is optional and they
 * combine: "Active, Level II, Plumbing" is three filters at once.
 *
 * `classKey` (`moduleId:level`, the value the module pickers hand back) asks
 * for the students a module is taught to at a level. It fixes the level, so a
 * separate `level` is ignored when it is given; `courseId` still narrows it to
 * one of the module's courses.
 */
export const studentListSchema = z.object({
  status: z.enum(STUDENT_LIST_STATUSES).default("ALL"),
  level: z.coerce.number().int().min(1).max(3).optional(),
  courseId: z.string().min(1).optional(),
  classKey: z.string().min(1).optional(),
  format: z.enum(["pdf", "csv"]).default("pdf"),
});

export type StudentListQuery = z.infer<typeof studentListSchema>;

/** Reads the filters from a query string, treating empty values as absent. */
export function parseStudentListParams(params: URLSearchParams) {
  const raw: Record<string, string> = {};
  for (const [key, value] of params) if (value !== "") raw[key] = value;
  return studentListSchema.parse(raw);
}
