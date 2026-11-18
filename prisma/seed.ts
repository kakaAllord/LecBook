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

  // Each course arrives with its core module, named after it and taught at
  // every level, exactly as adding a course in the app does.
  const courseNames = ["Electrical Installation", "Plumbing", "Computer Studies"];
  const courses = [];
  for (const name of courseNames) {
    courses.push(
      await prisma.course.create({
        data: { name, coreModule: { create: { name, kind: "CORE" } } },
        include: { coreModule: true },
      })
    );
  }
  console.log(`Created ${courses.length} courses, each with its core module`);

  // Related modules belong to a level and are taught to every course at it.
  const relatedData = [
    { name: "Communication Skills", code: "CS101", level: 1 },
    { name: "Mathematics", code: "MA101", level: 1 },
    { name: "Entrepreneurship", code: "EN201", level: 2 },
    { name: "Project Management", code: "PM301", level: 3 },
  ];
  const related = [];
  for (const m of relatedData) {
    related.push(await prisma.module.create({ data: { ...m, kind: "RELATED" } }));
  }
  console.log(`Created ${related.length} related modules`);

  // The seeded lecturer teaches two classes, which is what makes students
  // appear for them: the Electrical Installation core module at Level I, and
  // Mathematics (Level I) to every course.
  const electrical = courses[0];
  const mathematics = related.find((m) => m.name === "Mathematics")!;
  const classes = [
    { moduleId: electrical.coreModule!.id, level: 1, courseIds: [electrical.id] },
    { moduleId: mathematics.id, level: 1, courseIds: courses.map((c) => c.id) },
  ];
  await prisma.teachingAssignment.createMany({
    data: classes.flatMap((c) =>
      c.courseIds.map((courseId) => ({ lecturerId: lecturer.id, moduleId: c.moduleId, level: c.level, courseId }))
    ),
    skipDuplicates: true,
  });
  console.log(`Assigned ${classes.length} classes to the seeded lecturer`);

  let regCounter = 1;
  const students = [];
  for (const course of courses) {
    for (const level of [1, 2, 3]) {
      const count = randomInt(3, 5);
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
            level,
            status: "ACTIVE",
          },
        });
        students.push(student);
      }
    }
  }
  console.log(`Created ${students.length} students across Levels I–III`);

  // Assessment types per module. Each is marked out of its own total — a mix of
  // totals here so reports are exercised against the averaging, not a shared cap.
  const assessmentPlan = [
    { name: "Quiz 1", maxMarks: 20 },
    { name: "CAT 1", maxMarks: 50 },
    { name: "Assignment 1", maxMarks: 100 },
    { name: "Final Project", maxMarks: 100 },
  ];

  const assessments: {
    assessment: Awaited<ReturnType<typeof prisma.assessment.create>>;
    maxMarks: number;
    level: number;
    courseIds: string[];
  }[] = [];
  for (const cls of classes) {
    for (let i = 0; i < assessmentPlan.length; i++) {
      const plan = assessmentPlan[i];
      // Alternate between every course in the class and just the first, to
      // exercise both assessment scopes.
      const courseIds = cls.courseIds.length > 1 && i % 2 === 1 ? [cls.courseIds[0]] : cls.courseIds;
      const assessment = await prisma.assessment.create({
        data: {
          moduleId: cls.moduleId,
          level: cls.level,
          name: plan.name,
          maxMarks: plan.maxMarks,
          date: dayjs().subtract(randomInt(1, 20), "day").startOf("day").toDate(),
          courses: { connect: courseIds.map((id) => ({ id })) },
        },
      });
      assessments.push({ assessment, maxMarks: plan.maxMarks, level: cls.level, courseIds });
    }
  }
  console.log(`Created ${assessments.length} assessments`);

  let markCount = 0;
  for (const { assessment, maxMarks, level, courseIds } of assessments) {
    const scopedStudents = students.filter((s) => courseIds.includes(s.courseId) && s.level === level);
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
  const attendanceRecords: {
    studentId: string;
    moduleId: string;
    level: number;
    date: Date;
    status: "PRESENT" | "ABSENT";
  }[] = [];
  for (const cls of classes) {
    for (let d = 0; d < 8; d++) {
      const date = dayjs().subtract(d, "day").startOf("day").toDate();
      // Not every course in a class necessarily sits the same session.
      const sessionCourseIds =
        cls.courseIds.length > 1 ? cls.courseIds.filter(() => Math.random() > 0.3) : cls.courseIds;
      if (sessionCourseIds.length === 0) continue;

      const sessionStudents = students.filter((s) => sessionCourseIds.includes(s.courseId) && s.level === cls.level);
      for (const student of sessionStudents) {
        attendanceRecords.push({
          studentId: student.id,
          moduleId: cls.moduleId,
          level: cls.level,
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
