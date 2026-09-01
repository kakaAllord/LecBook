-- A course is enrolled on once, when a student starts, so it is a name and
-- nothing else. What runs in a given term is the module, which now carries the
-- level, semester and academic year the course used to.

-- AlterTable
ALTER TABLE "Module" ADD COLUMN "level" TEXT,
ADD COLUMN "semester" TEXT,
ADD COLUMN "academicYear" TEXT;

-- Carry each module's stage over from a course it runs for, so the modules
-- already recorded keep the term they were taught in instead of losing it with
-- the columns below. A module shared by several courses takes the first by
-- name; there is nothing better to go on, and an administrator can correct it.
UPDATE "Module" m
SET "level" = src."level",
    "semester" = src."semester",
    "academicYear" = src."academicYear"
FROM (
  SELECT DISTINCT ON (mc."B")
    mc."B" AS module_id,
    c."level",
    c."semester",
    c."academicYear"
  FROM "_ModuleCourses" mc
  JOIN "Course" c ON c."id" = mc."A"
  ORDER BY mc."B", c."name"
) AS src
WHERE m."id" = src.module_id;

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "level",
DROP COLUMN "semester",
DROP COLUMN "academicYear";
