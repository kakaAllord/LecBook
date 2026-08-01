-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "attendanceThreshold" REAL NOT NULL DEFAULT 75;
ALTER TABLE "Settings" ADD COLUMN "assessmentPassMark" REAL NOT NULL DEFAULT 50;
