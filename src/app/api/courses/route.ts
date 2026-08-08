import { ok, handleApiError } from "@/lib/api-response";
import { requireSession, requireAdmin, assertNotImpersonating } from "@/lib/auth";
import { parsePagination } from "@/lib/pagination";
import { courseSchema } from "@/lib/validators/course";
import { listCourses, listAllCourses, createCourse } from "@/lib/services/course.service";
import { getScopedCourseIds } from "@/lib/scope";
import { recordAudit } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const scopeIds = await getScopedCourseIds(session);
    const { searchParams } = new URL(request.url);

    if (searchParams.get("all") === "true") {
      return ok(await listAllCourses(scopeIds));
    }

    const search = searchParams.get("search")?.trim() ?? "";
    const { page, pageSize } = parsePagination(searchParams);
    return ok(await listCourses(search, page, pageSize, scopeIds));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    assertNotImpersonating(session);
    const data = courseSchema.parse(await request.json());
    const course = await createCourse(data);

    await recordAudit(session, {
      action: "course.create",
      entity: "Course",
      entityId: course.id,
      summary: `${session.name} created the course ${course.name} (${course.level}, ${course.semester})`,
    });

    return ok(course, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
