import { requireLecturerPage } from "@/lib/guard";
import { AssessmentsBoard } from "./AssessmentsBoard";

export default async function AssessmentsPage() {
  await requireLecturerPage();
  return <AssessmentsBoard />;
}
