import { ok, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { parsePagination } from "@/lib/pagination";
import { studentSchema } from "@/lib/validators/student";
import { listStudents, createStudent } from "@/lib/services/student.service";

export async function GET(request: Request) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const courseId = searchParams.get("courseId") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const { page, pageSize } = parsePagination(searchParams);
    const result = await listStudents({ search, courseId, status, page, pageSize });
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSession();
    const body = await request.json();
    const data = studentSchema.parse(body);
    const student = await createStudent(data);
    return ok(student, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
