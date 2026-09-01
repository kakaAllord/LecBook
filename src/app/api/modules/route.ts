import { ok, handleApiError } from "@/lib/api-response";
import { requireSession, requireAdmin, assertNotImpersonating } from "@/lib/auth";
import { parsePagination } from "@/lib/pagination";
import { moduleSchema } from "@/lib/validators/module";
import { listModules, listAllModules, createModule } from "@/lib/services/module.service";
import { getScopedModuleIds } from "@/lib/scope";
import { recordAudit } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const scopeIds = await getScopedModuleIds(session);
    const { searchParams } = new URL(request.url);

    if (searchParams.get("all") === "true") {
      return ok(await listAllModules(scopeIds));
    }

    const search = searchParams.get("search")?.trim() ?? "";
    const { page, pageSize } = parsePagination(searchParams);
    return ok(await listModules(search, page, pageSize, scopeIds));
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
      summary: `${session.name} created the module ${module_.name} (${module_.level}, ${module_.semester})`,
      metadata: {
        courses: module_.courses.map((c) => c.name),
        level: module_.level,
        semester: module_.semester,
        academicYear: module_.academicYear,
      },
    });

    return ok(module_, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
