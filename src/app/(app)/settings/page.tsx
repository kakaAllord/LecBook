import { requireAdminPage } from "@/lib/guard";
import { SettingsBoard } from "./SettingsBoard";

export default async function SettingsPage() {
  await requireAdminPage();
  return <SettingsBoard />;
}
