import { ok, handleApiError } from "@/lib/api-response";
import { requireRole, assertNotImpersonating } from "@/lib/auth";
import { teachingSettingsSchema } from "@/lib/validators/settings";
import { getTeachingSettings, updateTeachingSettings } from "@/lib/services/settings.service";
import { recordAudit } from "@/lib/audit";

/** The lecturer's own attendance threshold and pass mark. */
export async function GET() {
  try {
    const session = await requireRole("LECTURER");
    return ok(await getTeachingSettings(session));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireRole("LECTURER");
    assertNotImpersonating(session);
    const data = teachingSettingsSchema.parse(await request.json());
    await updateTeachingSettings(session.sub, data);

    await recordAudit(session, {
      action: "settings.teaching_update",
      entity: "User",
      entityId: session.sub,
      summary: `${session.name} set their attendance threshold to ${data.attendanceThreshold}% and pass mark to ${data.assessmentPassMark}%`,
      metadata: { ...data },
    });

    return ok(await getTeachingSettings(session));
  } catch (error) {
    return handleApiError(error);
  }
}
