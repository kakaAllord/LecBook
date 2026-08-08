import { requireAdminPage } from "@/lib/guard";
import { ModulesBoard } from "./ModulesBoard";

export default async function ModulesPage() {
  await requireAdminPage();
  return <ModulesBoard />;
}
