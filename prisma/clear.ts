import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Clearing all data except login credentials...");

  await prisma.assessmentMark.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.assessment.deleteMany({});
  await prisma.module.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.course.deleteMany({});
  await prisma.settings.deleteMany({});

  console.log("Done. Only the User table (login credentials) was left untouched.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
