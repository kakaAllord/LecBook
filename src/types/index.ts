export type StudentStatus = "ACTIVE" | "INACTIVE";
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
  modules: { id: string; name: string; code: string | null; courses: { id: string; name: string }[] }[];
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
  modules: { id: string; name: string }[];
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
  level: string;
  semester: string;
  academicYear: string;
  createdAt: string;
  modules?: Module[];
  _count?: { students: number };
};

export type Module = {
  id: string;
  name: string;
  code: string | null;
  createdAt: string;
  courses: Course[];
  _count?: { assessments: number };
};

export type Student = {
  id: string;
  registrationNumber: string;
  fullName: string;
  gender: string;
  phone: string | null;
  courseId: string;
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
  name: string;
  maxMarks: number;
  date: string;
  createdAt: string;
  module: Module;
  courses: Course[];
  _count?: { marks: number };
};

export type RemainingMarks = {
  cap: number;
  used: number;
  remaining: number;
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

export type DashboardSummary = {
  totalStudents: number;
  activeStudents: number;
  totalCourses: number;
  totalAssessments: number;
  todayAttendance: {
    present: number;
    absent: number;
    total: number;
  };
  recentAssessments: Assessment[];
};

export type Settings = {
  id: string;
  institutionName: string;
  institutionLogo: string | null;
  attendanceThreshold: number;
  assessmentPassMark: number;
  updatedAt: string;
};
