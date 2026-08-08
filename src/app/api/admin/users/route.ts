import { ok, handleApiError } from "@/lib/api-response";
import { requireAdmin, assertNotImpersonating } from "@/lib/auth";
import { parsePagination } from "@/lib/pagination";
import { createUserSchema } from "@/lib/validators/user";
import { listUsers, createUser } from "@/lib/services/user.service";
import { recordAudit } from "@/lib/audit";
import { buildInviteUrl } from "@/lib/invite-url";

export async function GET(request: Request) {
  try {
    const session = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const role = searchParams.get("role") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const createdById = searchParams.get("createdById") ?? undefined;
    const { page, pageSize } = parsePagination(searchParams);

    const result = await listUsers(session, { search, role, status, createdById, page, pageSize });
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    assertNotImpersonating(session);

    const body = await request.json();
    const data = createUserSchema.parse(body);
    const { user, token } = await createUser(session, data);

    await recordAudit(session, {
      action: "user.create",
      entity: "User",
      entityId: user.id,
      summary: `${session.name} added ${data.role === "ADMIN" ? "admin" : "lecturer"} ${user.name} (${user.email})`,
      metadata: {
        role: user.role,
        courses: user.courses.length,
        modules: user.modules.length,
      },
    });

    return ok({ user, inviteUrl: buildInviteUrl(request, token) }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
