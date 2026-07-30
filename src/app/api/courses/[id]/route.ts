import { ok, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { courseUpdateSchema } from "@/lib/validators/course";
import { getCourse, updateCourse, deleteCourse } from "@/lib/services/course.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const course = await getCourse(id);
    return ok(course);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = courseUpdateSchema.parse(body);
    const course = await updateCourse(id, data);
    return ok(course);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    await deleteCourse(id);
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
