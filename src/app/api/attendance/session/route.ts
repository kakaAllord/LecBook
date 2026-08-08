import dayjs from "dayjs";
import { ok, handleApiError } from "@/lib/api-response";
import { requireSession, assertNotImpersonating } from "@/lib/auth";
import { moveAttendanceSchema, deleteAttendanceSchema } from "@/lib/validators/attendance";
import { moveAttendanceSession, deleteAttendanceSession } from "@/lib/services/attendance.service";
import { assertModuleAccess } from "@/lib/scope";
import { recordAudit } from "@/lib/audit";

/** Moves an already-saved session onto the module, date and courses it belonged to. */
export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    assertNotImpersonating(session);
    const data = moveAttendanceSchema.parse(await request.json());

    await assertModuleAccess(session, data.moduleId);
    await assertModuleAccess(session, data.targetModuleId);

    const result = await moveAttendanceSession(data, session.sub);

    await recordAudit(session, {
      action: "attendance.move",
      entity: "Attendance",
      entityId: data.targetModuleId,
      summary: `${session.name} moved ${result.moved} attendance record${result.moved === 1 ? "" : "s"} to ${result.module.name} on ${dayjs(result.date).format("DD MMM YYYY")}${result.removed > 0 ? ` and removed ${result.removed} from courses no longer attending` : ""}`,
      metadata: {
        fromModuleId: data.moduleId,
        fromDate: data.date,
        toModuleId: data.targetModuleId,
        toDate: data.targetDate,
        moved: result.moved,
        removed: result.removed,
      },
    });

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession();
    assertNotImpersonating(session);
    const data = deleteAttendanceSchema.parse(await request.json());
    await assertModuleAccess(session, data.moduleId);

    const result = await deleteAttendanceSession(data);

    await recordAudit(session, {
      action: "attendance.delete",
      entity: "Attendance",
      entityId: data.moduleId,
      summary: `${session.name} deleted the attendance for ${result.module.name} on ${dayjs(result.date).format("DD MMM YYYY")} (${result.deleted} records)`,
      metadata: { moduleId: data.moduleId, date: data.date, deleted: result.deleted },
    });

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
