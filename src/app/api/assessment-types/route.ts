import { ok, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { assessmentTypeSchema } from "@/lib/validators/assessment";
import { listAssessmentTypes, createAssessmentType } from "@/lib/services/assessment-type.service";

export async function GET() {
  try {
    await requireSession();
    const types = await listAssessmentTypes();
    return ok(types);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSession();
    const body = await request.json();
    const data = assessmentTypeSchema.parse(body);
    const type = await createAssessmentType(data);
    return ok(type, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
