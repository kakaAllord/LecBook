import { ok, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { settingsSchema } from "@/lib/validators/settings";
import { getSettings, updateSettings } from "@/lib/services/settings.service";

export async function GET() {
  try {
    await requireSession();
    const settings = await getSettings();
    return ok(settings);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireSession();
    const body = await request.json();
    const data = settingsSchema.parse(body);
    const settings = await updateSettings(data);
    return ok(settings);
  } catch (error) {
    return handleApiError(error);
  }
}
