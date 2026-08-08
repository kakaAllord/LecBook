import { ok, handleApiError } from "@/lib/api-response";
import { requireSuperAdmin } from "@/lib/auth";
import { parsePagination } from "@/lib/pagination";
import { listAuditLogs, getAuditFilterOptions } from "@/lib/services/audit.service";

export async function GET(request: Request) {
  try {
    await requireSuperAdmin();
    const { searchParams } = new URL(request.url);

    if (searchParams.get("filters") === "true") {
      return ok(await getAuditFilterOptions());
    }

    const { page, pageSize } = parsePagination(searchParams);
    const result = await listAuditLogs({
      search: searchParams.get("search")?.trim() ?? "",
      userId: searchParams.get("userId") ?? undefined,
      action: searchParams.get("action") ?? undefined,
      entity: searchParams.get("entity") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      page,
      pageSize,
    });

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
