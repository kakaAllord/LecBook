import { requireStaffPage } from "@/lib/guard";
import { StudentsBoard } from "./StudentsBoard";

export default async function StudentsPage() {
  // Lecturers get a read-only roll: registration is the admin's job.
  const session = await requireStaffPage();
  return <StudentsBoard canManage={session.role === "ADMIN"} />;
}
