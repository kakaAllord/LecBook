import { ok, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { studentUpdateSchema } from "@/lib/validators/student";
import { getStudent, updateStudent, deleteStudent } from "@/lib/services/student.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const student = await getStudent(id);
    return ok(student);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = studentUpdateSchema.parse(body);
    const student = await updateStudent(id, data);
    return ok(student);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireSession();
    const { id } = await params;
    await deleteStudent(id);
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
