import dayjs from "dayjs";
import { PrismaClient } from "@prisma/client";
import { seedCredentials } from "./seed-credentials";

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

  const { lecturer } = await seedCredentials(prisma);

  const courseData = [
    { name: "Electrical Engineering", level: "Level 5", semester: "Semester II", academicYear: "2026" },
    { name: "Mechanical Engineering", level: "Level 4", semester: "Semester I", academicYear: "2026" },
    { name: "Computer Science", level: "Level 6", semester: "Semester II", academicYear: "2026" },
  ];
  const courses: Awaited<ReturnType<typeof prisma.course.create>>[] = [];
  for (const c of courseData) {
    const course = await prisma.course.create({ data: c });
    courses.push(course);
  }
  console.log(`Created ${courses.length} courses`);

  const findCourse = (name: string) => courses.find((c) => c.name === name)!;

  // Modules demonstrate both scenarios: a module scoped to a single course,
  // and a module shared across several courses that may attend on different days.
  const moduleData = [
    { name: "Database Systems", code: "CS201", courseNames: ["Computer Science"] },
    { name: "Circuit Theory", code: "EE210", courseNames: ["Electrical Engineering"] },
    { name: "Thermodynamics", code: "ME220", courseNames: ["Mechanical Engineering"] },
    { name: "Programming Fundamentals", code: "CS101", courseNames: ["Computer Science", "Electrical Engineering"] },
    {
      name: "Linear Algebra",
      code: "MATH101",
      courseNames: ["Electrical Engineering", "Mechanical Engineering", "Computer Science"],
    },
  ];
  const modules = [];
  for (const m of moduleData) {
    const linkedCourses = m.courseNames.map(findCourse);
    const module_ = await prisma.module.create({
      data: {
        name: m.name,
        code: m.code,
        courses: { connect: linkedCourses.map((c) => ({ id: c.id })) },
      },
      include: { courses: true },
    });
    modules.push(module_);
  }
  console.log(`Created ${modules.length} modules`);

  // The admin assigns the lecturer their courses; that assignment is what makes
  // the students show up for them without them registering anyone.
  await prisma.user.update({
    where: { id: lecturer.id },
    data: {
      courses: { set: courses.map((c) => ({ id: c.id })) },
      modules: { set: modules.map((m) => ({ id: m.id })) },
    },
  });
  console.log(`Assigned ${courses.length} courses to the seeded lecturer`);

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

  // Assessment types/marks, per module, summing to the 60-mark cap.
  const assessmentPlan = [
    { name: "Quiz 1", maxMarks: 10 },
    { name: "CAT 1", maxMarks: 20 },
    { name: "Assignment 1", maxMarks: 15 },
    { name: "Final Project", maxMarks: 15 },
  ];

  const assessments: { assessment: Awaited<ReturnType<typeof prisma.assessment.create>>; maxMarks: number; courseIds: string[] }[] = [];
  for (const module_ of modules) {
    const moduleCourseIds = module_.courses.map((c) => c.id);
    for (let i = 0; i < assessmentPlan.length; i++) {
      const plan = assessmentPlan[i];
      // Alternate between "all courses" and a single course when a module has several,
      // to exercise both assessment-scope options.
      const courseIds = moduleCourseIds.length > 1 && i % 2 === 1 ? [moduleCourseIds[0]] : moduleCourseIds;
      const assessment = await prisma.assessment.create({
        data: {
          moduleId: module_.id,
          name: plan.name,
          maxMarks: plan.maxMarks,
          date: dayjs().subtract(randomInt(1, 20), "day").startOf("day").toDate(),
          courses: { connect: courseIds.map((id) => ({ id })) },
        },
      });
      assessments.push({ assessment, maxMarks: plan.maxMarks, courseIds });
    }
  }
  console.log(`Created ${assessments.length} assessments`);

  let markCount = 0;
  for (const { assessment, maxMarks, courseIds } of assessments) {
    const scopedStudents = students.filter((s) => courseIds.includes(s.courseId));
    for (const student of scopedStudents) {
      const marks = Math.round(randomInt(Math.floor(maxMarks * 0.4), maxMarks) * 10) / 10;
      await prisma.assessmentMark.create({
        data: {
          assessmentId: assessment.id,
          studentId: student.id,
          marks,
        },
      });
      markCount++;
    }
  }
  console.log(`Created ${markCount} assessment marks`);

  const attendanceStatuses: Array<"PRESENT" | "ABSENT"> = [
    "PRESENT", "PRESENT", "PRESENT", "PRESENT", "ABSENT",
  ];
  const attendanceRecords: { studentId: string; moduleId: string; date: Date; status: "PRESENT" | "ABSENT" }[] = [];
  for (const module_ of modules) {
    const moduleCourseIds = module_.courses.map((c) => c.id);
    for (let d = 0; d < 8; d++) {
      const date = dayjs().subtract(d, "day").startOf("day").toDate();
      // Not every linked course necessarily attends the same session/day.
      const sessionCourseIds =
        moduleCourseIds.length > 1 ? moduleCourseIds.filter(() => Math.random() > 0.3) : moduleCourseIds;
      if (sessionCourseIds.length === 0) continue;

      const sessionStudents = students.filter((s) => sessionCourseIds.includes(s.courseId));
      for (const student of sessionStudents) {
        attendanceRecords.push({
          studentId: student.id,
          moduleId: module_.id,
          date,
          status: randomFrom(attendanceStatuses),
        });
      }
    }
  }
  // Batched in one round trip (with chunking for very large sets) to avoid
  // the pooled connection idling out over hundreds of sequential awaits.
  const CHUNK_SIZE = 500;
  for (let i = 0; i < attendanceRecords.length; i += CHUNK_SIZE) {
    await prisma.attendance.createMany({
      data: attendanceRecords.slice(i, i + CHUNK_SIZE),
      skipDuplicates: true,
    });
  }
  console.log(`Created ${attendanceRecords.length} attendance records`);

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
