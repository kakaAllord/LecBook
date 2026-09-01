-- The institution pass mark is 60%, not 50%. There is no screen that edits it
-- — an administrator sets the institution's name and logo, a lecturer sets
-- their own bar — so the row itself has to be corrected here.

-- AlterTable
ALTER TABLE "Settings" ALTER COLUMN "assessmentPassMark" SET DEFAULT 60;

-- Move the institution off the old default. A row that was deliberately set to
-- something else is left alone.
UPDATE "Settings" SET "assessmentPassMark" = 60 WHERE "assessmentPassMark" = 50;
