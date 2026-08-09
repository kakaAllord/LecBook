import { requireLecturerPage } from "@/lib/guard";
import { MarksBoard } from "./MarksBoard";

export default async function AssessmentDetailPage() {
  await requireLecturerPage();
  return <MarksBoard />;
}
