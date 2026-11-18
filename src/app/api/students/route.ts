import { ok, handleApiError } from "@/lib/api-response";
import { requireSession, requireAdmin, assertNotImpersonating } from "@/lib/auth";
import { parsePagination } from "@/lib/pagination";
import { studentSchema } from "@/lib/validators/student";
import { listStudents, createStudent } from "@/lib/services/student.service";
import { studentScopeWhere } from "@/lib/scope";
import { parseLevelParam } from "@/lib/validators/module";
import { levelLabel } from "@/lib/levels";
import { recordAudit } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const scopeWhere = await studentScopeWhere(session);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const courseId = searchParams.get("courseId") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const level = parseLevelParam(searchParams.get("level"));
    const { page, pageSize } = parsePagination(searchParams);

    const result = await listStudents({ search, courseId, level, status, page, pageSize, scopeWhere });
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Registering students is an admin responsibility — lecturers only consume the roll. */
export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    assertNotImpersonating(session);
    const data = studentSchema.parse(await request.json());
    const student = await createStudent(data);

    await recordAudit(session, {
      action: "student.create",
      entity: "Student",
      entityId: student.id,
      summary: `${session.name} registered ${student.fullName} (${student.registrationNumber}) at ${levelLabel(student.level)}`,
    });

    return ok(student, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
