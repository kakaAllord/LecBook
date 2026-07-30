import { ok, fail, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { getAttendanceHistory } from "@/lib/services/attendance.service";

export async function GET(request: Request) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId");
    if (!courseId) {
      return fail("courseId is required", 422);
    }
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;
    const history = await getAttendanceHistory(courseId, from, to);
    return ok(history);
  } catch (error) {
    return handleApiError(error);
  }
}
