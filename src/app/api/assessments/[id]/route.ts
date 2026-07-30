import { ok, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { getAssessmentDetail, deleteAssessment } from "@/lib/services/assessment.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const detail = await getAssessmentDetail(id);
    return ok(detail);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    await deleteAssessment(id);
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
