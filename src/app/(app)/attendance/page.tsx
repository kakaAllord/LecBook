import { Suspense } from "react";
import { AttendanceBoard } from "./AttendanceBoard";

export default function AttendancePage() {
  return (
    <Suspense fallback={null}>
      <AttendanceBoard />
    </Suspense>
  );
}
