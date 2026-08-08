import { handleApiError } from "@/lib/api-response";
import { requireSuperAdmin } from "@/lib/auth";
import { generateProposalPdf } from "@/lib/services/proposal.service";

export const runtime = "nodejs";

/** The commercial proposal is a super admin document, not something a college sees in-app. */
export async function GET() {
  try {
    await requireSuperAdmin();
    const { pdf, filename } = await generateProposalPdf();

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
