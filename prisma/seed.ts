import bcrypt from "bcryptjs";
import dayjs from "dayjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const GENDERS = ["Male", "Female"];

const FIRST_NAMES = [
  "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
  "David", "Elizabeth", "Joseph", "Susan", "Charles", "Jessica", "Daniel", "Sarah",
  "Peter", "Grace", "Samuel", "Faith",
];
const LAST_NAMES = [
  "Otieno", "Wanjiru", "Mwangi", "Njoroge", "Kariuki", "Achieng", "Kamau", "Mutua",
  "Odhiambo", "Wafula", "Kimani", "Nyambura", "Omondi", "Chebet", "Barasa", "Wekesa",
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("REDACTED_SEED_PASSWORD", 10);
  const lecturer = await prisma.user.upsert({
    where: { email: "lecturer@example.com" },
    update: { password: passwordHash },
    create: {
      name: "Wickleaf",
      email: "lecturer@example.com",
      password: passwordHash,
    },
  });
  console.log(`Lecturer user ready: ${lecturer.email}`);

  const courseData = [
    { name: "Electrical Engineering", level: "Level 5", semester: "Semester II", academicYear: "2026" },
    { name: "Mechanical Engineering", level: "Level 4", semester: "Semester I", academicYear: "2026" },
    { name: "Computer Science", level: "Level 6", semester: "Semester II", academicYear: "2026" },
  ];
  const courses = [];
  for (const c of courseData) {
    const course = await prisma.course.create({ data: c });
    courses.push(course);
  }
  console.log(`Created ${courses.length} courses`);

  const assessmentTypeData = [
    { name: "Quiz", maxMarks: 20, description: "Short in-class quiz" },
    { name: "Test", maxMarks: 30, description: "Written test" },
    { name: "Assignment", maxMarks: 20, description: "Take-home assignment" },
    { name: "Practical", maxMarks: 50, description: "Practical/lab exercise" },
    { name: "Presentation", maxMarks: 20, description: "Oral presentation" },
    { name: "Project", maxMarks: 100, description: "Term project" },
  ];
  const assessmentTypes = [];
  for (const t of assessmentTypeData) {
    const type = await prisma.assessmentType.create({ data: t });
    assessmentTypes.push(type);
  }
  console.log(`Created ${assessmentTypes.length} assessment types`);

  let regCounter = 1;
  const students = [];
  for (const course of courses) {
    const count = randomInt(6, 9);
    for (let i = 0; i < count; i++) {
      const fullName = `${randomFrom(FIRST_NAMES)} ${randomFrom(LAST_NAMES)}`;
      const registrationNumber = `REG-${String(regCounter).padStart(4, "0")}`;
      regCounter++;
      const student = await prisma.student.create({
        data: {
          registrationNumber,
          fullName,
          gender: randomFrom(GENDERS),
          phone: `07${randomInt(10000000, 99999999)}`,
          courseId: course.id,
          status: "ACTIVE",
        },
      });
      students.push(student);
    }
  }
  console.log(`Created ${students.length} students`);

  const assessments = [];
  for (const course of courses) {
    const typesForCourse = [assessmentTypes[0], assessmentTypes[1], assessmentTypes[2]];
    let n = 1;
    for (const type of typesForCourse) {
      const assessment = await prisma.assessment.create({
        data: {
          courseId: course.id,
          assessmentTypeId: type.id,
          title: `${type.name} ${n}`,
          date: dayjs().subtract(randomInt(1, 20), "day").startOf("day").toDate(),
        },
      });
      assessments.push({ assessment, type, course });
      n++;
    }
  }
  console.log(`Created ${assessments.length} assessments`);

  for (const { assessment, type, course } of assessments) {
    const courseStudents = students.filter((s) => s.courseId === course.id);
    for (const student of courseStudents) {
      const marks = Math.round(randomInt(Math.floor(type.maxMarks * 0.4), type.maxMarks) * 10) / 10;
      await prisma.assessmentMark.create({
        data: {
          assessmentId: assessment.id,
          studentId: student.id,
          marks,
        },
      });
    }
  }
  console.log("Created assessment marks");

  const attendanceStatuses: Array<"PRESENT" | "ABSENT" | "LATE" | "EXCUSED"> = [
    "PRESENT", "PRESENT", "PRESENT", "PRESENT", "ABSENT", "LATE", "EXCUSED",
  ];
  let attendanceCount = 0;
  for (let d = 0; d < 10; d++) {
    const date = dayjs().subtract(d, "day").startOf("day").toDate();
    for (const student of students) {
      await prisma.attendance.upsert({
        where: { studentId_date: { studentId: student.id, date } },
        update: {},
        create: {
          studentId: student.id,
          date,
          status: randomFrom(attendanceStatuses),
        },
      });
      attendanceCount++;
    }
  }
  console.log(`Created ${attendanceCount} attendance records`);

  console.log("Seeding complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
