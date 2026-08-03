import { ok, fail, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { getRemainingMarks } from "@/lib/services/assessment.service";

export async function GET(request: Request) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get("moduleId");
    if (!moduleId) return fail("moduleId is required", 422);
    const result = await getRemainingMarks(moduleId);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
