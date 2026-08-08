import { requireSuperAdminPage } from "@/lib/guard";
import { LogTerminal } from "./LogTerminal";

export default async function AdminLogsPage() {
  await requireSuperAdminPage();
  return <LogTerminal />;
}
