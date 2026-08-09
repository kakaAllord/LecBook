import { requireAdminPage } from "@/lib/guard";
import { LecturersBoard } from "./LecturersBoard";

export default async function LecturersPage() {
  await requireAdminPage();
  return <LecturersBoard />;
}
