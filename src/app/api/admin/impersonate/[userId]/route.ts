import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/api-response";
import {
  getSession,
  requireSuperAdmin,
  signImpersonationToken,
  IMPERSONATION_COOKIE,
  IMPERSONATION_COOKIE_OPTIONS,
} from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ userId: string }> };

/**
 * Starts a "view as user" session and redirects to the dashboard, so this can be
 * opened straight into a new tab from the user list. The super admin's own token
 * is untouched — only an extra cookie is layered on top of it.
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const session = await requireSuperAdmin();
    const { userId } = await params;

    if (userId === session.sub) {
      throw new ApiError("You are already signed in as yourself", 422);
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!target) throw new ApiError("User not found", 404);

    const store = await cookies();
    store.set(
      IMPERSONATION_COOKIE,
      signImpersonationToken({ actorId: session.sub, actorName: session.name, targetId: target.id }),
      IMPERSONATION_COOKIE_OPTIONS
    );

    await recordAudit(session, {
      action: "user.impersonate_start",
      entity: "User",
      entityId: target.id,
      summary: `${session.name} started viewing the app as ${target.name} (${target.email})`,
      metadata: { targetRole: target.role },
    });

    return Response.redirect(new URL("/", request.url), 303);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Ends the view-as session and returns the super admin to their own account. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError("Not authenticated", 401);
    const { userId } = await params;

    const store = await cookies();
    store.delete(IMPERSONATION_COOKIE);

    if (session.impersonatedById) {
      await recordAudit(
        {
          sub: session.impersonatedById,
          name: session.impersonatorName ?? "Super Admin",
          email: "",
          role: "SUPER_ADMIN",
        },
        {
          action: "user.impersonate_end",
          entity: "User",
          entityId: userId,
          summary: `${session.impersonatorName ?? "Super admin"} stopped viewing as ${session.name}`,
        }
      );
    }

    return Response.json({ success: true, data: { exited: true } });
  } catch (error) {
    return handleApiError(error);
  }
}
