import { ok, handleApiError } from "@/lib/api-response";
import { requireSession, requireAdmin, assertNotImpersonating } from "@/lib/auth";
import { courseUpdateSchema } from "@/lib/validators/course";
import { getCourse, updateCourse, deleteCourse } from "@/lib/services/course.service";
import { assertCourseAccess } from "@/lib/scope";
import { recordAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await assertCourseAccess(session, id);
    return ok(await getCourse(id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    assertNotImpersonating(session);
    const { id } = await params;
    const data = courseUpdateSchema.parse(await request.json());
    const course = await updateCourse(id, data);

    await recordAudit(session, {
      action: "course.update",
      entity: "Course",
      entityId: id,
      summary: `${session.name} updated the course ${course.name}`,
    });

    return ok(course);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    assertNotImpersonating(session);
    const { id } = await params;
    const course = await getCourse(id);
    await deleteCourse(id);

    await recordAudit(session, {
      action: "course.delete",
      entity: "Course",
      entityId: id,
      summary: `${session.name} deleted the course ${course.name}`,
    });

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
