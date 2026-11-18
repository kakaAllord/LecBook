import dayjs from "dayjs";
import { ok, handleApiError } from "@/lib/api-response";
import { requireSession, assertNotImpersonating } from "@/lib/auth";
import { moveAttendanceSchema, deleteAttendanceSchema } from "@/lib/validators/attendance";
import { moveAttendanceSession, deleteAttendanceSession } from "@/lib/services/attendance.service";
import { recordAudit } from "@/lib/audit";

/**
 * Moves an already-saved session onto the module, level, date and courses it
 * belonged to. The service checks the session may use both the source and the
 * destination.
 */
export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    assertNotImpersonating(session);
    const data = moveAttendanceSchema.parse(await request.json());

    const result = await moveAttendanceSession(session, data);

    await recordAudit(session, {
      action: "attendance.move",
      entity: "Attendance",
      entityId: data.targetModuleId,
      summary: `${session.name} moved ${result.moved} attendance record${result.moved === 1 ? "" : "s"} to ${result.label} on ${dayjs(result.date).format("DD MMM YYYY")}${result.removed > 0 ? ` and removed ${result.removed} from courses no longer attending` : ""}`,
      metadata: {
        fromModuleId: data.moduleId,
        fromLevel: data.level,
        fromDate: data.date,
        toModuleId: data.targetModuleId,
        toLevel: data.targetLevel,
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

    const result = await deleteAttendanceSession(session, data);

    await recordAudit(session, {
      action: "attendance.delete",
      entity: "Attendance",
      entityId: data.moduleId,
      summary: `${session.name} deleted the attendance for ${result.label} on ${dayjs(result.date).format("DD MMM YYYY")} (${result.deleted} records)`,
      metadata: { moduleId: data.moduleId, level: data.level, date: data.date, deleted: result.deleted },
    });

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
