import { ok, fail, handleApiError } from "@/lib/api-response";
import { requireSession, assertNotImpersonating } from "@/lib/auth";
import { parseLevelParam } from "@/lib/validators/module";
import { saveAttendanceSchema } from "@/lib/validators/attendance";
import { getAttendanceForDate, saveAttendance } from "@/lib/services/attendance.service";
import { recordAudit } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get("moduleId");
    const level = parseLevelParam(searchParams.get("level"));
    const courseIdsParam = searchParams.get("courseIds");
    const date = searchParams.get("date");
    if (!moduleId || !level || !courseIdsParam || !date) {
      return fail("moduleId, level, courseIds and date are required", 422);
    }
    const courseIds = courseIdsParam.split(",").filter(Boolean);
    // The service checks the session may use this module at this level.
    return ok(await getAttendanceForDate(session, moduleId, level, courseIds, date));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    assertNotImpersonating(session);
    const data = saveAttendanceSchema.parse(await request.json());

    const result = await saveAttendance(session, data);

    const present = data.records.filter((r) => r.status === "PRESENT").length;
    await recordAudit(session, {
      action: "attendance.save",
      entity: "Attendance",
      entityId: data.moduleId,
      summary: `${session.name} saved attendance for ${result.label} on ${data.date} (${present}/${data.records.length} present)`,
      metadata: { moduleId: data.moduleId, level: data.level, date: data.date, records: data.records.length, present },
    });

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
