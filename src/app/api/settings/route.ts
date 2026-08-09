import { ok, handleApiError } from "@/lib/api-response";
import { requireSession, requireRole, assertNotImpersonating } from "@/lib/auth";
import { institutionSettingsSchema } from "@/lib/validators/settings";
import { getSettingsFor, updateSettings } from "@/lib/services/settings.service";
import { recordAudit } from "@/lib/audit";

/** Institution settings, with the thresholds that apply to the caller. */
export async function GET() {
  try {
    const session = await requireSession();
    return ok(await getSettingsFor(session));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    // How the institution presents itself is the administrator's to set; the
    // thresholds moved to each lecturer's own settings.
    const session = await requireRole("ADMIN");
    assertNotImpersonating(session);
    const data = institutionSettingsSchema.parse(await request.json());
    const settings = await updateSettings(data);

    await recordAudit(session, {
      action: "settings.update",
      entity: "Settings",
      entityId: settings.id,
      summary: `${session.name} updated the institution settings`,
      metadata: { institutionName: settings.institutionName },
    });

    return ok(settings);
  } catch (error) {
    return handleApiError(error);
  }
}
