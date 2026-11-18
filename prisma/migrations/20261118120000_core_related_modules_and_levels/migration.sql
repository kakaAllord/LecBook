-- Modules become two kinds, students get a level of study, and a lecturer is
-- assigned a module at a level to particular courses.
--
--   CORE     one per course, named after it, taught at every level I–III
--   RELATED  belongs to one level, taught to every course at that level
--
-- Every attendance record and mark is kept. Existing rows are carried over by
-- rule; anything the rule gets wrong is corrected on screen afterwards:
--
--   * A module linked to exactly one course and named like it becomes that
--     course's core module. Every other module becomes a related module.
--   * A module's old free-text level ("Level II", "3", "III") is read as
--     I, II or III. Anything else is read as Level I.
--   * Every course without a core module gets one.
--   * Each lecturer keeps their modules, at the module's level, for the
--     courses the module was linked to.
--   * Students start at Level I; the administrator sets the real levels.
--   * The per-module semester and academic year are dropped: the term a piece
--     of teaching belongs to is now the student's level, and the dates on the
--     registers and assessments themselves.

-- CreateEnum
CREATE TYPE "ModuleKind" AS ENUM ('CORE', 'RELATED');

-- AlterEnum
ALTER TYPE "StudentStatus" ADD VALUE 'COMPLETED';

-- Read each module's old level text as 1, 2 or 3 before anything depends on it.
-- III is tested before II so "Level III" is not read as Level II.
ALTER TABLE "Module" ADD COLUMN "levelNumber" INTEGER;
UPDATE "Module"
SET "levelNumber" = CASE
  WHEN "level" ~* '(^|[^a-z0-9])(iii|3)([^a-z0-9]|$)' THEN 3
  WHEN "level" ~* '(^|[^a-z0-9])(ii|2)([^a-z0-9]|$)' THEN 2
  ELSE 1
END;

-- Students
ALTER TABLE "Student" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;

-- Registers and assessments record the level they were taught at.
ALTER TABLE "Attendance" ADD COLUMN "level" INTEGER;
UPDATE "Attendance" a SET "level" = m."levelNumber" FROM "Module" m WHERE m."id" = a."moduleId";
ALTER TABLE "Attendance" ALTER COLUMN "level" SET NOT NULL;

ALTER TABLE "Assessment" ADD COLUMN "level" INTEGER;
UPDATE "Assessment" a SET "level" = m."levelNumber" FROM "Module" m WHERE m."id" = a."moduleId";
ALTER TABLE "Assessment" ALTER COLUMN "level" SET NOT NULL;

-- Module kind, and the course a core module belongs to.
ALTER TABLE "Module"
ADD COLUMN "kind" "ModuleKind" NOT NULL DEFAULT 'RELATED',
ADD COLUMN "courseId" TEXT;

-- A module linked to exactly one course, whose name matches that course's
-- (ignoring case and stray spaces), is that course's core module. If more than
-- one qualifies for a course, the oldest wins and the rest stay related.
UPDATE "Module" m
SET "kind" = 'CORE', "courseId" = pick.course_id
FROM (
  SELECT DISTINCT ON (only_link.course_id) only_link.module_id, only_link.course_id
  FROM (
    SELECT mc."B" AS module_id, MIN(mc."A") AS course_id
    FROM "_ModuleCourses" mc
    GROUP BY mc."B"
    HAVING COUNT(*) = 1
  ) only_link
  JOIN "Module" mm ON mm."id" = only_link.module_id
  JOIN "Course" c ON c."id" = only_link.course_id
  WHERE lower(btrim(mm."name")) = lower(btrim(c."name"))
  ORDER BY only_link.course_id, mm."createdAt", mm."id"
) pick
WHERE m."id" = pick.module_id;

-- CreateTable
CREATE TABLE "TeachingAssignment" (
    "id" TEXT NOT NULL,
    "lecturerId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeachingAssignment_pkey" PRIMARY KEY ("id")
);

-- Lecturers keep exactly what they taught: each module they had, at the
-- module's level, for each course the module was linked to.
INSERT INTO "TeachingAssignment" ("id", "lecturerId", "moduleId", "level", "courseId")
SELECT
  'ta_' || md5(ml."B" || ':' || ml."A" || ':' || mc."A"),
  ml."B",
  ml."A",
  m."levelNumber",
  mc."A"
FROM "_ModuleLecturers" ml
JOIN "Module" m ON m."id" = ml."A"
JOIN "_ModuleCourses" mc ON mc."B" = ml."A"
JOIN "User" u ON u."id" = ml."B"
WHERE u."role" = 'LECTURER';

-- Every course gets its core module, named after it.
INSERT INTO "Module" ("id", "name", "kind", "courseId", "levelNumber", "createdAt")
SELECT 'core_' || md5(c."id"), c."name", 'CORE', c."id", NULL, CURRENT_TIMESTAMP
FROM "Course" c
WHERE NOT EXISTS (SELECT 1 FROM "Module" m WHERE m."courseId" = c."id");

-- A core module carries its course's name exactly.
UPDATE "Module" m SET "name" = c."name" FROM "Course" c WHERE c."id" = m."courseId";

-- Swap the old text level for the number; a core module runs at every level,
-- so it has none of its own.
ALTER TABLE "Module" DROP COLUMN "level";
ALTER TABLE "Module" RENAME COLUMN "levelNumber" TO "level";
UPDATE "Module" SET "level" = NULL WHERE "kind" = 'CORE';

ALTER TABLE "Module" DROP COLUMN "semester", DROP COLUMN "academicYear";

-- The old many-to-many links are fully replaced by the core module's course,
-- the related module's level, and the teaching assignments above.
DROP TABLE "_ModuleCourses";
DROP TABLE "_ModuleLecturers";

-- Levels are I, II and III, and a module is either core-with-a-course or
-- related-with-a-level, never both or neither.
ALTER TABLE "Student" ADD CONSTRAINT "Student_level_check" CHECK ("level" BETWEEN 1 AND 3);
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_level_check" CHECK ("level" BETWEEN 1 AND 3);
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_level_check" CHECK ("level" BETWEEN 1 AND 3);
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_level_check" CHECK ("level" BETWEEN 1 AND 3);
ALTER TABLE "Module" ADD CONSTRAINT "Module_kind_shape_check" CHECK (
  ("kind" = 'CORE' AND "courseId" IS NOT NULL AND "level" IS NULL)
  OR ("kind" = 'RELATED' AND "courseId" IS NULL AND "level" BETWEEN 1 AND 3)
);

-- CreateIndex
CREATE INDEX "TeachingAssignment_moduleId_level_idx" ON "TeachingAssignment"("moduleId", "level");

-- CreateIndex
CREATE INDEX "TeachingAssignment_courseId_level_idx" ON "TeachingAssignment"("courseId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingAssignment_lecturerId_moduleId_level_courseId_key" ON "TeachingAssignment"("lecturerId", "moduleId", "level", "courseId");

-- CreateIndex
CREATE INDEX "Assessment_moduleId_level_idx" ON "Assessment"("moduleId", "level");

-- CreateIndex
CREATE INDEX "Attendance_moduleId_level_idx" ON "Attendance"("moduleId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "Module_courseId_key" ON "Module"("courseId");

-- CreateIndex
CREATE INDEX "Student_courseId_level_idx" ON "Student"("courseId", "level");

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
