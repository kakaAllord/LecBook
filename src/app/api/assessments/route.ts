import { ok, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { assessmentSchema } from "@/lib/validators/assessment";
import { listAssessments, createAssessment } from "@/lib/services/assessment.service";
import { assertModuleAccess, getScopedModuleIds } from "@/lib/scope";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const scopeModuleIds = await getScopedModuleIds(session);
    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get("moduleId") ?? undefined;
    const courseId = searchParams.get("courseId") ?? undefined;
    const assessments = await listAssessments(moduleId, courseId, scopeModuleIds);
    return ok(assessments);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const data = assessmentSchema.parse(body);
    await assertModuleAccess(session, data.moduleId);
    const assessment = await createAssessment(data);
    return ok(assessment, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
