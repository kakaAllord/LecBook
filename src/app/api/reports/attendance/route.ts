import { fail, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { parseLevelParam } from "@/lib/validators/module";
import { generateAttendanceReport } from "@/lib/services/report.service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get("moduleId");
    const level = parseLevelParam(searchParams.get("level"));
    if (!moduleId || !level) return fail("moduleId and level are required", 422);

    const courseId = searchParams.get("courseId") ?? undefined;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;
    // A module id in the query string is not permission to report on it: the
    // service resolves the class against the session and refuses otherwise.
    const { pdf, filename } = await generateAttendanceReport(session, moduleId, level, courseId, from, to);

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
