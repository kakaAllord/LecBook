import { ok, handleApiError } from "@/lib/api-response";
import { requireSession, requireAdmin, assertNotImpersonating } from "@/lib/auth";
import { settingsSchema } from "@/lib/validators/settings";
import { getSettings, updateSettings } from "@/lib/services/settings.service";
import { recordAudit } from "@/lib/audit";

export async function GET() {
  try {
    await requireSession();
    return ok(await getSettings());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAdmin();
    assertNotImpersonating(session);
    const data = settingsSchema.parse(await request.json());
    const settings = await updateSettings(data);

    await recordAudit(session, {
      action: "settings.update",
      entity: "Settings",
      entityId: settings.id,
      summary: `${session.name} updated the institution settings`,
      metadata: {
        institutionName: settings.institutionName,
        attendanceThreshold: settings.attendanceThreshold,
        assessmentPassMark: settings.assessmentPassMark,
      },
    });

    return ok(settings);
  } catch (error) {
    return handleApiError(error);
  }
}
