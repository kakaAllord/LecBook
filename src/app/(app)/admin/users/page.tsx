import { requireSuperAdminPage } from "@/lib/guard";
import { UsersBoard } from "./UsersBoard";

export default async function AdminUsersPage() {
  await requireSuperAdminPage();
  return <UsersBoard />;
}
