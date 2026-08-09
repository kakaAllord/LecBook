import { fail, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { assertModuleAccess } from "@/lib/scope";
import { generateAttendanceReport } from "@/lib/services/report.service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get("moduleId");
    if (!moduleId) return fail("moduleId is required", 422);
    // A module id in the query string is not permission to report on it.
    await assertModuleAccess(session, moduleId);

    const courseId = searchParams.get("courseId") ?? undefined;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;
    const { pdf, filename } = await generateAttendanceReport(session, moduleId, courseId, from, to);

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
