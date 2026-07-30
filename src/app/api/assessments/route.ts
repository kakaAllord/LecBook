import { ok, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { assessmentSchema } from "@/lib/validators/assessment";
import { listAssessments, createAssessment } from "@/lib/services/assessment.service";

export async function GET(request: Request) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId") ?? undefined;
    const assessments = await listAssessments(courseId);
    return ok(assessments);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSession();
    const body = await request.json();
    const data = assessmentSchema.parse(body);
    const assessment = await createAssessment(data);
    return ok(assessment, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
