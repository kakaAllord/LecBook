import { requireStaffPage } from "@/lib/guard";
import { InstitutionSettingsBoard } from "./InstitutionSettingsBoard";
import { TeachingSettingsBoard } from "./TeachingSettingsBoard";

export default async function SettingsPage() {
  const session = await requireStaffPage();
  // Two different screens behind one route: the admin configures the
  // institution, the lecturer configures their own marking bar.
  return session.role === "ADMIN" ? <InstitutionSettingsBoard /> : <TeachingSettingsBoard />;
}
