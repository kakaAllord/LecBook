import { fail, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { generateAssessmentReport, generateAllAssessmentsReport } from "@/lib/services/report.service";

export const runtime = "nodejs";

function pdfResponse(pdf: Buffer, filename: string) {
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(request: Request) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get("assessmentId");
    const courseId = searchParams.get("courseId");

    if (assessmentId) {
      const { pdf, filename } = await generateAssessmentReport(assessmentId);
      return pdfResponse(pdf, filename);
    }
    if (courseId) {
      const { pdf, filename } = await generateAllAssessmentsReport(courseId);
      return pdfResponse(pdf, filename);
    }
    return fail("assessmentId or courseId is required", 422);
  } catch (error) {
    return handleApiError(error);
  }
}
