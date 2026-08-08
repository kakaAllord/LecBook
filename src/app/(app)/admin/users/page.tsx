import { requireAdminPage } from "@/lib/guard";
import { UsersBoard } from "./UsersBoard";

export default async function AdminUsersPage() {
  const session = await requireAdminPage();
  return <UsersBoard viewerRole={session.role} viewerId={session.sub} />;
}
