export type StudentStatus = "ACTIVE" | "INACTIVE";
export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export type Course = {
  id: string;
  name: string;
  level: string;
  semester: string;
  academicYear: string;
  createdAt: string;
  _count?: { students: number };
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
  course: Course;
  date: string;
  students: AttendanceDayEntry[];
};

export type AttendanceHistoryEntry = {
  date: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
};

export type AssessmentType = {
  id: string;
  name: string;
  maxMarks: number;
  description: string | null;
  createdAt: string;
  _count?: { assessments: number };
};

export type Assessment = {
  id: string;
  courseId: string;
  assessmentTypeId: string;
  title: string;
  date: string;
  createdAt: string;
  course: Course;
  assessmentType: AssessmentType;
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

export type DashboardSummary = {
  totalStudents: number;
  activeStudents: number;
  totalCourses: number;
  totalAssessments: number;
  todayAttendance: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
  };
  recentAssessments: Assessment[];
};
