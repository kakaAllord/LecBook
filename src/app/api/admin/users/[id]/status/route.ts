import { z } from "zod";
import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin, assertNotImpersonating } from "@/lib/auth";
import { setUserStatus } from "@/lib/services/user.service";
import { recordAudit } from "@/lib/audit";

const schema = z.object({ active: z.boolean() });

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    assertNotImpersonating(session);
    const { id } = await params;
    const { active } = schema.parse(await request.json());

    const user = await setUserStatus(session, id, active);

    await recordAudit(session, {
      action: active ? "user.activate" : "user.deactivate",
      entity: "User",
      entityId: id,
      summary: `${session.name} ${active ? "activated" : "deactivated"} ${user.name}`,
    });

    return ok(user);
  } catch (error) {
    return handleApiError(error);
  }
}
