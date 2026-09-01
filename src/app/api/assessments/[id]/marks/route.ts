import { ok, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { saveMarksSchema } from "@/lib/validators/assessment";
import { saveMarks } from "@/lib/services/assessment.service";
import { assertAssessmentAccess } from "@/lib/scope";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await assertAssessmentAccess(session, id);
    const body = await request.json();
    const data = saveMarksSchema.parse(body);
    const result = await saveMarks(id, data);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
