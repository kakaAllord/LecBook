import { requireAdminPage } from "@/lib/guard";
import { UsersBoard } from "@/app/(app)/admin/users/UsersBoard";

export default async function LecturersPage() {
  const session = await requireAdminPage();
  return <UsersBoard viewerRole={session.role} viewerId={session.sub} />;
}
