import { requireStaffPage } from "@/lib/guard";
import { SettingsBoard } from "./SettingsBoard";

export default async function SettingsPage() {
  await requireStaffPage();
  return <SettingsBoard />;
}
