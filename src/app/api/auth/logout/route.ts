import { cookies } from "next/headers";
import { ok } from "@/lib/api-response";
import { AUTH_COOKIE, IMPERSONATION_COOKIE, getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export async function POST() {
  const session = await getSession();
  if (session && !session.impersonatedById) {
    await recordAudit(session, {
      action: "auth.logout",
      entity: "User",
      entityId: session.sub,
      summary: `${session.name} signed out`,
    });
  }

  const store = await cookies();
  store.delete(AUTH_COOKIE);
  store.delete(IMPERSONATION_COOKIE);
  return ok({ loggedOut: true });
}
