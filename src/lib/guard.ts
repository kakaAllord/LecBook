import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { getSession, type Session } from "@/lib/auth";

/**
 * Page-level guard for server components. Hiding a link in the sidebar is not
 * access control — every page calls one of these so someone who types a URL
 * belonging to another role's workspace is sent back to their own dashboard.
 */
export async function requirePageRole(...roles: UserRole[]): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!roles.includes(session.role)) redirect("/");
  return session;
}

/** The operations workspace: insights, users, logs. */
export function requireSuperAdminPage() {
  return requirePageRole("SUPER_ADMIN");
}

/**
 * Administration pages. Super admins are deliberately excluded: their own
 * account has three tabs, and they reach an administrator's view through
 * "view as", which resolves the session to that administrator.
 */
export function requireAdminPage() {
  return requirePageRole("ADMIN");
}

/** Teaching pages — registers and mark sheets belong to the lecturer. */
export function requireLecturerPage() {
  return requirePageRole("LECTURER");
}

/** Pages an admin and a lecturer both have, showing each of them something different. */
export function requireStaffPage() {
  return requirePageRole("ADMIN", "LECTURER");
}
