import { ok, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { getAssessmentDetail, deleteAssessment } from "@/lib/services/assessment.service";
import { assertAssessmentAccess } from "@/lib/scope";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await assertAssessmentAccess(session, id);
    const detail = await getAssessmentDetail(id);
    return ok(detail);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await assertAssessmentAccess(session, id);
    await deleteAssessment(id);
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
