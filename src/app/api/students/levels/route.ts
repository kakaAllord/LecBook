import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin, assertNotImpersonating } from "@/lib/auth";
import { setLevelSchema } from "@/lib/validators/student";
import { setStudentLevels } from "@/lib/services/student.service";
import { recordAudit } from "@/lib/audit";
import { levelLabel } from "@/lib/levels";

/** Puts the selected students at one level. Administrators only. */
export async function PATCH(request: Request) {
  try {
    const session = await requireAdmin();
    assertNotImpersonating(session);
    const data = setLevelSchema.parse(await request.json());
    const result = await setStudentLevels(data.studentIds, data.level);

    await recordAudit(session, {
      action: "student.level",
      entity: "Student",
      summary: `${session.name} set ${result.updated} student${result.updated === 1 ? "" : "s"} to ${levelLabel(data.level)}`,
      metadata: { level: data.level, studentIds: data.studentIds },
    });

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
