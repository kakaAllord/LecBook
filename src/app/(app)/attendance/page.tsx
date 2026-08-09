import { Suspense } from "react";
import { requireLecturerPage } from "@/lib/guard";
import { AttendanceBoard } from "./AttendanceBoard";

export default async function AttendancePage() {
  await requireLecturerPage();
  return (
    <Suspense fallback={null}>
      <AttendanceBoard />
    </Suspense>
  );
}
