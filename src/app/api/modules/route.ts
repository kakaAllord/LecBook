import { ok, handleApiError } from "@/lib/api-response";
import { requireSession, requireAdmin, assertNotImpersonating } from "@/lib/auth";
import { parsePagination } from "@/lib/pagination";
import { moduleSchema, parseLevelParam } from "@/lib/validators/module";
import { listModules, listAllModules, createModule } from "@/lib/services/module.service";
import { getScopedModuleIds } from "@/lib/scope";
import { recordAudit } from "@/lib/audit";
import { levelLabel } from "@/lib/levels";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const scopeIds = await getScopedModuleIds(session);
    const { searchParams } = new URL(request.url);

    if (searchParams.get("all") === "true") {
      return ok(await listAllModules(scopeIds));
    }

    const search = searchParams.get("search")?.trim() ?? "";
    const kindParam = searchParams.get("kind");
    const kind = kindParam === "CORE" || kindParam === "RELATED" ? kindParam : undefined;
    const level = parseLevelParam(searchParams.get("level"));
    const { page, pageSize } = parsePagination(searchParams);
    return ok(await listModules({ search, kind, level, page, pageSize }, scopeIds));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    assertNotImpersonating(session);
    const data = moduleSchema.parse(await request.json());
    const module_ = await createModule(data);

    await recordAudit(session, {
      action: "module.create",
      entity: "Module",
      entityId: module_.id,
      summary: `${session.name} created the related module ${module_.name} (${levelLabel(data.level)})`,
      metadata: { kind: module_.kind, level: module_.level, code: module_.code },
    });

    return ok(module_, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
