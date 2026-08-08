import { ok, handleApiError } from "@/lib/api-response";
import { requireSession, requireAdmin, assertNotImpersonating } from "@/lib/auth";
import { moduleUpdateSchema } from "@/lib/validators/module";
import { getModule, updateModule, deleteModule } from "@/lib/services/module.service";
import { assertModuleAccess } from "@/lib/scope";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await assertModuleAccess(session, id);
    return ok(await getModule(id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    assertNotImpersonating(session);
    const { id } = await params;
    const data = moduleUpdateSchema.parse(await request.json());
    const module_ = await updateModule(id, data);

    await recordAudit(session, {
      action: "module.update",
      entity: "Module",
      entityId: id,
      summary: `${session.name} updated the module ${module_.name}`,
    });

    return ok(module_);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    assertNotImpersonating(session);
    const { id } = await params;
    const module_ = await getModule(id);
    await deleteModule(id);

    await recordAudit(session, {
      action: "module.delete",
      entity: "Module",
      entityId: id,
      summary: `${session.name} deleted the module ${module_.name}`,
    });

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
