-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "institutionLogo" TEXT;

-- Attendance now only supports PRESENT/ABSENT; fold any legacy LATE/EXCUSED
-- records into ABSENT so existing data stays valid against the new enum.
UPDATE "Attendance" SET "status" = 'ABSENT' WHERE "status" NOT IN ('PRESENT', 'ABSENT');
