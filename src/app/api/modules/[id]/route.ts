import { ok, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { moduleUpdateSchema } from "@/lib/validators/module";
import { getModule, updateModule, deleteModule } from "@/lib/services/module.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const module_ = await getModule(id);
    return ok(module_);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = moduleUpdateSchema.parse(body);
    const module_ = await updateModule(id, data);
    return ok(module_);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    await deleteModule(id);
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
