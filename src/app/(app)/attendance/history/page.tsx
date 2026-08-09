import { requireLecturerPage } from "@/lib/guard";
import { HistoryBoard } from "./HistoryBoard";

export default async function AttendanceHistoryPage() {
  await requireLecturerPage();
  return <HistoryBoard />;
}
