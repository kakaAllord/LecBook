import { requireAdminPage } from "@/lib/guard";
import { CoursesBoard } from "./CoursesBoard";

export default async function CoursesPage() {
  await requireAdminPage();
  return <CoursesBoard />;
}
