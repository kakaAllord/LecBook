import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin, assertNotImpersonating } from "@/lib/auth";
import { updateUserSchema } from "@/lib/validators/user";
import { getViewableUser, updateUser, deleteUser } from "@/lib/services/user.service";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    return ok(await getViewableUser(session, id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    assertNotImpersonating(session);
    const { id } = await params;
    const data = updateUserSchema.parse(await request.json());
    const user = await updateUser(session, id, data);

    await recordAudit(session, {
      action: "user.update",
      entity: "User",
      entityId: user.id,
      summary: `${session.name} updated the account for ${user.name}`,
      metadata: { fields: Object.keys(data) },
    });

    return ok(user);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    assertNotImpersonating(session);
    const { id } = await params;
    const user = await getViewableUser(session, id);
    await deleteUser(session, id);

    await recordAudit(session, {
      action: "user.delete",
      entity: "User",
      entityId: id,
      summary: `${session.name} deleted the account for ${user.name} (${user.email})`,
    });

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
