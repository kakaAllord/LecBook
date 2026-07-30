import { fail, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { generateAttendanceReport } from "@/lib/services/report.service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId");
    if (!courseId) return fail("courseId is required", 422);

    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;
    const { pdf, filename } = await generateAttendanceReport(courseId, from, to);

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
