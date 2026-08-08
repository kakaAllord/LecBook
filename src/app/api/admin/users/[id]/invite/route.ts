import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin, assertNotImpersonating } from "@/lib/auth";
import { regenerateInvite, revokeInvites } from "@/lib/services/user.service";
import { recordAudit } from "@/lib/audit";
import { buildInviteUrl } from "@/lib/invite-url";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    assertNotImpersonating(session);
    const { id } = await params;
    const { user, token } = await regenerateInvite(session, id);

    await recordAudit(session, {
      action: "user.invite_created",
      entity: "User",
      entityId: id,
      summary: `${session.name} generated a new invite link for ${user.name}`,
    });

    return ok({ user, inviteUrl: buildInviteUrl(request, token) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    assertNotImpersonating(session);
    const { id } = await params;
    await revokeInvites(session, id);

    await recordAudit(session, {
      action: "user.invite_revoked",
      entity: "User",
      entityId: id,
      summary: `${session.name} revoked the outstanding invite link`,
    });

    return ok({ revoked: true });
  } catch (error) {
    return handleApiError(error);
  }
}
