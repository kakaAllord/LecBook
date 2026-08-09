import { requireSuperAdminPage } from "@/lib/guard";
import { UsersBoard } from "./UsersBoard";

export default async function AdminUsersPage() {
  const session = await requireSuperAdminPage();
  return <UsersBoard viewerRole={session.role} viewerId={session.sub} />;
}
