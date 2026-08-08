import { ok, handleApiError } from "@/lib/api-response";
import { requireSession, requireAdmin, assertNotImpersonating } from "@/lib/auth";
import { studentUpdateSchema } from "@/lib/validators/student";
import { getStudent, updateStudent, deleteStudent } from "@/lib/services/student.service";
import { assertStudentAccess } from "@/lib/scope";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await assertStudentAccess(session, id);
    return ok(await getStudent(id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    assertNotImpersonating(session);
    const { id } = await params;
    const data = studentUpdateSchema.parse(await request.json());
    const student = await updateStudent(id, data);

    await recordAudit(session, {
      action: "student.update",
      entity: "Student",
      entityId: id,
      summary: `${session.name} updated ${student.fullName} (${student.registrationNumber})`,
      metadata: { fields: Object.keys(data) },
    });

    return ok(student);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    assertNotImpersonating(session);
    const { id } = await params;
    const student = await getStudent(id);
    await deleteStudent(id);

    await recordAudit(session, {
      action: "student.delete",
      entity: "Student",
      entityId: id,
      summary: `${session.name} deleted ${student.fullName} (${student.registrationNumber})`,
    });

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
