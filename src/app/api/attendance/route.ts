import { ok, fail, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { saveAttendanceSchema } from "@/lib/validators/attendance";
import { getAttendanceForDate, saveAttendance } from "@/lib/services/attendance.service";

export async function GET(request: Request) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId");
    const date = searchParams.get("date");
    if (!courseId || !date) {
      return fail("courseId and date are required", 422);
    }
    const result = await getAttendanceForDate(courseId, date);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSession();
    const body = await request.json();
    const data = saveAttendanceSchema.parse(body);
    const result = await saveAttendance(data);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
