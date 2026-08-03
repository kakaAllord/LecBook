export type StudentStatus = "ACTIVE" | "INACTIVE";
export type AttendanceStatus = "PRESENT" | "ABSENT";

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
