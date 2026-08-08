import { requireSuperAdminPage } from "@/lib/guard";
import { MetricsBoard } from "./MetricsBoard";

export default async function AdminMetricsPage() {
  await requireSuperAdminPage();
  return <MetricsBoard />;
}
