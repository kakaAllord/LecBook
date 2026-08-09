import { ok, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { assertStudentAccess } from "@/lib/scope";
import { studentExportSchema } from "@/lib/validators/export";
import {
  buildStudentExport,
  renderStudentExportPdf,
  renderStudentExportText,
} from "@/lib/services/student-export.service";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * One endpoint, three shapes: `format=pdf` downloads a document, `format=text`
 * returns a block ready to paste elsewhere, and the default returns the raw
 * data so the dialog can preview it before the user commits to a download.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;
    await assertStudentAccess(session, id);

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "json";
    const options = studentExportSchema.parse(await request.json());

    const data = await buildStudentExport(session, id, options);

    if (format === "pdf") {
      const { pdf, filename } = await renderStudentExportPdf(data, options);
      await recordAudit(session, {
        action: "student.export",
        entity: "Student",
        entityId: id,
        summary: `${session.name} exported the record for ${data.student.fullName} (${data.student.registrationNumber}) as PDF`,
        metadata: {
          attendance: options.includeAttendance,
          assessments: options.includeAssessments,
          range: data.filters.attendanceRange,
        },
      });

      return new Response(new Uint8Array(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    if (format === "text") {
      await recordAudit(session, {
        action: "student.export",
        entity: "Student",
        entityId: id,
        summary: `${session.name} copied the record for ${data.student.fullName} (${data.student.registrationNumber})`,
      });
      return ok({ text: renderStudentExportText(data, options) });
    }

    return ok(data);
  } catch (error) {
    return handleApiError(error);
  }
}
