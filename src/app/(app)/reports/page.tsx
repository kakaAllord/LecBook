import { requireStaffPage } from "@/lib/guard";
import { ReportsBoard } from "./ReportsBoard";

export default async function ReportsPage() {
  const session = await requireStaffPage();
  return <ReportsBoard role={session.role} />;
}
