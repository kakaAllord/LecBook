import { getSession, isAdminRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StudentsBoard } from "./StudentsBoard";

export default async function StudentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  // Lecturers get a read-only roll: registration is the admin's job.
  return <StudentsBoard canManage={isAdminRole(session.role)} />;
}
