import { ok, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { assessmentTypeUpdateSchema } from "@/lib/validators/assessment";
import {
  updateAssessmentType,
  deleteAssessmentType,
} from "@/lib/services/assessment-type.service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = assessmentTypeUpdateSchema.parse(body);
    const type = await updateAssessmentType(id, data);
    return ok(type);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    await deleteAssessmentType(id);
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
