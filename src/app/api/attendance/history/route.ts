import { ok, fail, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { getAttendanceHistory } from "@/lib/services/attendance.service";

export async function GET(request: Request) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get("moduleId");
    if (!moduleId) {
      return fail("moduleId is required", 422);
    }
    const courseIdsParam = searchParams.get("courseIds");
    const courseIds = courseIdsParam ? courseIdsParam.split(",").filter(Boolean) : undefined;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;
    const history = await getAttendanceHistory(moduleId, courseIds, from, to);
    return ok(history);
  } catch (error) {
    return handleApiError(error);
  }
}
