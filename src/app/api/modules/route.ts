import { ok, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { parsePagination } from "@/lib/pagination";
import { moduleSchema } from "@/lib/validators/module";
import { listModules, listAllModules, createModule } from "@/lib/services/module.service";

export async function GET(request: Request) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);

    if (searchParams.get("all") === "true") {
      const items = await listAllModules();
      return ok(items);
    }

    const search = searchParams.get("search")?.trim() ?? "";
    const { page, pageSize } = parsePagination(searchParams);
    const result = await listModules(search, page, pageSize);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSession();
    const body = await request.json();
    const data = moduleSchema.parse(body);
    const module_ = await createModule(data);
    return ok(module_, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
