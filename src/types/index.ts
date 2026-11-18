import type { TeachingLine } from "@/lib/teaching-lines";

export type { TeachingLine };

export type StudentStatus = "ACTIVE" | "INACTIVE" | "COMPLETED";
export type ModuleKind = "CORE" | "RELATED";
export type AttendanceStatus = "PRESENT" | "ABSENT";
export type UserRole = "SUPER_ADMIN" | "ADMIN" | "LECTURER";
export type UserStatus = "ACTIVE" | "INACTIVE" | "PENDING";
export type DeviceType = "DESKTOP" | "MOBILE" | "TABLET" | "UNKNOWN";

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  phone: string | null;
  title: string | null;
  staffId: string | null;
  createdById: string | null;
  lastLoginAt: string | null;
  loginCount: number;
  createdAt: string;
  createdBy: { id: string; name: string; email: string } | null;
  /** What a lecturer teaches, one line per module and level. */
  teaching: TeachingLine[];
  _count: { createdUsers: number; sessions: number };
};

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  phone: string | null;
  title: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  impersonatedBy: { id: string; name: string } | null;
};

export type AuditLogEntry = {
  id: string;
  userId: string | null;
  actorName: string;
  actorEmail: string;
  actorRole: UserRole;
  action: string;
  entity: string;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  impersonatedById: string | null;
  createdAt: string;
};

export type Course = {
  id: string;
  name: string;
  createdAt: string;
  coreModule?: { id: string; name: string; code: string | null } | null;
  _count?: { students: number };
};

/**
 * A CORE module belongs to one course (`course`) and runs at every level; a
 * RELATED module belongs to one level (`level`) and runs for every course.
 */
export type Module = {
  id: string;
  name: string;
  code: string | null;
  kind: ModuleKind;
  courseId: string | null;
  level: number | null;
  createdAt: string;
  course: { id: string; name: string } | null;
  _count?: { assessments: number; attendance: number; assignments: number };
};

/** A module at one level, with the courses this account uses it for. */
export type TeachingUnit = {
  key: string;
  moduleId: string;
  name: string;
  code: string | null;
  kind: ModuleKind;
  level: number;
  label: string;
  courses: { id: string; name: string }[];
};

export type Student = {
  id: string;
  registrationNumber: string;
  fullName: string;
  gender: string;
  phone: string | null;
  courseId: string;
  level: number;
  status: StudentStatus;
  createdAt: string;
  course?: Course;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AttendanceRecord = {
  id: string;
  status: AttendanceStatus;
  remarks: string | null;
};

export type AttendanceDayEntry = {
  student: Student;
  attendance: AttendanceRecord | null;
};

export type AttendanceForDate = {
  module: Module;
  level: number;
  label: string;
  courseIds: string[];
  date: string;
  students: AttendanceDayEntry[];
};

export type AttendanceHistoryEntry = {
  date: string;
  present: number;
  absent: number;
  total: number;
};

export type Assessment = {
  id: string;
  moduleId: string;
  level: number;
  /** "Electrical Installation Level I" */
  label: string;
  name: string;
  maxMarks: number;
  date: string;
  createdAt: string;
  module: Pick<Module, "id" | "name" | "code" | "kind">;
  courses: Course[];
  _count?: { marks: number };
};

export type AssessmentMarkEntry = {
  id: string;
  marks: number;
  remarks: string | null;
};

export type AssessmentStudentEntry = {
  student: Student;
  mark: AssessmentMarkEntry | null;
};

export type AssessmentDetail = {
  assessment: Assessment;
  students: AssessmentStudentEntry[];
};

export type Settings = {
  id: string;
  institutionName: string;
  institutionLogo: string | null;
  attendanceThreshold: number;
  assessmentPassMark: number;
  updatedAt: string;
};
