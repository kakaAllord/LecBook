import { fail, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertModuleAccess } from "@/lib/scope";
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
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get("assessmentId");
    const moduleId = searchParams.get("moduleId");
    const courseId = searchParams.get("courseId") ?? undefined;

    if (assessmentId) {
      // The assessment's module decides who may download it.
      const assessment = await prisma.assessment.findUnique({
        where: { id: assessmentId },
        select: { moduleId: true },
      });
      if (!assessment) return fail("Assessment not found", 404);
      await assertModuleAccess(session, assessment.moduleId);

      const { pdf, filename } = await generateAssessmentReport(session, assessmentId);
      return pdfResponse(pdf, filename);
    }
    if (moduleId) {
      await assertModuleAccess(session, moduleId);
      const { pdf, filename } = await generateAllAssessmentsReport(session, moduleId, courseId);
      return pdfResponse(pdf, filename);
    }
    return fail("assessmentId or moduleId is required", 422);
  } catch (error) {
    return handleApiError(error);
  }
}
