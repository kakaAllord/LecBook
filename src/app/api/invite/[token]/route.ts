import { ok, handleApiError } from "@/lib/api-response";
import { acceptInviteSchema } from "@/lib/validators/user";
import { getInviteByToken, acceptInvite } from "@/lib/services/user.service";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ token: string }> };

/** Public: lets the invite page show who the invite is for before it is accepted. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const invite = await getInviteByToken(token);
    return ok({
      email: invite.user.email,
      name: invite.user.name,
      role: invite.user.role,
      title: invite.user.title,
      phone: invite.user.phone,
      staffId: invite.user.staffId,
      modules: invite.user.modules,
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const data = acceptInviteSchema.parse(await request.json());
    const user = await acceptInvite(token, data);

    await recordAudit(
      { sub: user.id, name: user.name, email: user.email, role: user.role },
      {
        action: "auth.invite_accepted",
        entity: "User",
        entityId: user.id,
        summary: `${user.name} completed their account setup`,
      }
    );

    return ok({ email: user.email, name: user.name });
  } catch (error) {
    return handleApiError(error);
  }
}
