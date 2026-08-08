import { ok, handleApiError } from "@/lib/api-response";
import { requireSuperAdmin } from "@/lib/auth";
import { getUsageMetrics, type MetricsRange } from "@/lib/services/metrics.service";

export async function GET(request: Request) {
  try {
    await requireSuperAdmin();
    const { searchParams } = new URL(request.url);
    const requested = Number(searchParams.get("range"));
    const range: MetricsRange = requested === 7 || requested === 90 ? requested : 30;
    return ok(await getUsageMetrics(range));
  } catch (error) {
    return handleApiError(error);
  }
}
