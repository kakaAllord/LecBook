import { ok, handleApiError } from "@/lib/api-response";
import { requireSession, assertNotImpersonating } from "@/lib/auth";
import { assessmentSchema } from "@/lib/validators/assessment";
import { parseLevelParam } from "@/lib/validators/module";
import { listAssessments, createAssessment } from "@/lib/services/assessment.service";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const assessments = await listAssessments(session, {
      moduleId: searchParams.get("moduleId") ?? undefined,
      level: parseLevelParam(searchParams.get("level")),
      courseId: searchParams.get("courseId") ?? undefined,
    });
    return ok(assessments);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    assertNotImpersonating(session);
    const data = assessmentSchema.parse(await request.json());
    // The service checks the session teaches this module at this level.
    const assessment = await createAssessment(session, data);
    return ok(assessment, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
