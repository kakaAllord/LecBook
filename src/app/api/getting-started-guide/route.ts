import { handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { getSettings } from "@/lib/services/settings.service";
import { generateGettingStartedGuide } from "@/lib/services/guide.service";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireSession();
    const settings = await getSettings();
    const pdf = await generateGettingStartedGuide(settings.institutionName);

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="getting-started-guide.pdf"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
