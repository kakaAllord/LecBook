import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { getSession, type Session } from "@/lib/auth";

/**
 * Page-level guard for server components. Hiding a link in the sidebar is not
 * access control — every admin-only page calls this so a lecturer who types the
 * URL directly is sent back to their dashboard.
 */
export async function requirePageRole(...roles: UserRole[]): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!roles.includes(session.role)) redirect("/");
  return session;
}

export function requireAdminPage() {
  return requirePageRole("ADMIN", "SUPER_ADMIN");
}

export function requireSuperAdminPage() {
  return requirePageRole("SUPER_ADMIN");
}
