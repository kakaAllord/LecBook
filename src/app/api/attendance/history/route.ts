import { ok, fail, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { parseLevelParam } from "@/lib/validators/module";
import { getAttendanceHistory } from "@/lib/services/attendance.service";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get("moduleId");
    const level = parseLevelParam(searchParams.get("level"));
    if (!moduleId || !level) {
      return fail("moduleId and level are required", 422);
    }
    const courseIdsParam = searchParams.get("courseIds");
    const courseIds = courseIdsParam ? courseIdsParam.split(",").filter(Boolean) : undefined;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;
    // Scoped by the service: a lecturer only sees history for their own classes.
    return ok(await getAttendanceHistory(session, moduleId, level, courseIds, from, to));
  } catch (error) {
    return handleApiError(error);
  }
}
