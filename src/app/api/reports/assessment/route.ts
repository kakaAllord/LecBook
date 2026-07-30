import { fail, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { generateAssessmentReport } from "@/lib/services/report.service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get("assessmentId");
    if (!assessmentId) return fail("assessmentId is required", 422);

    const { pdf, filename } = await generateAssessmentReport(assessmentId);

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
