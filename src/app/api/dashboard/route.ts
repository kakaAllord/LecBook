import { ok, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/services/dashboard.service";

export async function GET() {
  try {
    await requireSession();
    const summary = await getDashboardSummary();
    return ok(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
