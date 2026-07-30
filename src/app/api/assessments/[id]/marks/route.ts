import { ok, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { saveMarksSchema } from "@/lib/validators/assessment";
import { saveMarks } from "@/lib/services/assessment.service";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = saveMarksSchema.parse(body);
    const result = await saveMarks(id, data);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
