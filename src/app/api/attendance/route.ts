import { ok, fail, handleApiError } from "@/lib/api-response";
import { requireSession, assertNotImpersonating } from "@/lib/auth";
import { saveAttendanceSchema } from "@/lib/validators/attendance";
import { getAttendanceForDate, saveAttendance } from "@/lib/services/attendance.service";
import { assertModuleAccess } from "@/lib/scope";
import { recordAudit } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get("moduleId");
    const courseIdsParam = searchParams.get("courseIds");
    const date = searchParams.get("date");
    if (!moduleId || !courseIdsParam || !date) {
      return fail("moduleId, courseIds and date are required", 422);
    }
    await assertModuleAccess(session, moduleId);
    const courseIds = courseIdsParam.split(",").filter(Boolean);
    return ok(await getAttendanceForDate(moduleId, courseIds, date));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    assertNotImpersonating(session);
    const data = saveAttendanceSchema.parse(await request.json());
    await assertModuleAccess(session, data.moduleId);

    const result = await saveAttendance(data, session.sub);

    const present = data.records.filter((r) => r.status === "PRESENT").length;
    await recordAudit(session, {
      action: "attendance.save",
      entity: "Attendance",
      entityId: data.moduleId,
      summary: `${session.name} saved attendance for ${result.module.name} on ${data.date} (${present}/${data.records.length} present)`,
      metadata: { moduleId: data.moduleId, date: data.date, records: data.records.length, present },
    });

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
