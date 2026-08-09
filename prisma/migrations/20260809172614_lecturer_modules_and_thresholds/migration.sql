/*
  Warnings:

  - You are about to drop the `_CourseLecturers` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_CourseLecturers" DROP CONSTRAINT "_CourseLecturers_A_fkey";

-- DropForeignKey
ALTER TABLE "_CourseLecturers" DROP CONSTRAINT "_CourseLecturers_B_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "assessmentPassMark" DOUBLE PRECISION,
ADD COLUMN     "attendanceThreshold" DOUBLE PRECISION;

-- DropTable
DROP TABLE "_CourseLecturers";
