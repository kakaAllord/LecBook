import { ok, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/services/dashboard.service";
import { getScopedCourseIds, getScopedModuleIds } from "@/lib/scope";

export async function GET() {
  try {
    const session = await requireSession();
    const [courseIds, moduleIds] = await Promise.all([
      getScopedCourseIds(session),
      getScopedModuleIds(session),
    ]);
    return ok(await getDashboardSummary({ courseIds, moduleIds }));
  } catch (error) {
    return handleApiError(error);
  }
}
