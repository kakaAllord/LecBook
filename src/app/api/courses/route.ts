import { ok, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { parsePagination } from "@/lib/pagination";
import { courseSchema } from "@/lib/validators/course";
import { listCourses, listAllCourses, createCourse } from "@/lib/services/course.service";

export async function GET(request: Request) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);

    if (searchParams.get("all") === "true") {
      const items = await listAllCourses();
      return ok(items);
    }

    const search = searchParams.get("search")?.trim() ?? "";
    const { page, pageSize } = parsePagination(searchParams);
    const result = await listCourses(search, page, pageSize);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSession();
    const body = await request.json();
    const data = courseSchema.parse(body);
    const course = await createCourse(data);
    return ok(course, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
