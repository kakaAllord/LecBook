import { handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { parseStudentListParams } from "@/lib/validators/student-list";
import {
  buildStudentList,
  renderStudentListCsv,
  renderStudentListPdf,
  studentListFilename,
} from "@/lib/services/student-list.service";

export const runtime = "nodejs";

/**
 * The student list as a PDF or a CSV. Filters are optional and combine; the
 * service keeps a lecturer inside their own courses and levels whatever the
 * query string asks for.
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const query = parseStudentListParams(new URL(request.url).searchParams);
    const list = await buildStudentList(session, query);

    // It carries names and phone numbers for a whole group, so it is logged
    // the way a single student's export is.
    await recordAudit(session, {
      action: "report.download",
      entity: "Student",
      summary: `${session.name} downloaded the student list (${list.scope} · ${list.status}) as ${query.format.toUpperCase()}, ${list.students.length} student${list.students.length === 1 ? "" : "s"}`,
      metadata: { report: "student-list", ...query, count: list.students.length },
    });

    const filename = studentListFilename(query, query.format);
    const body = query.format === "csv" ? renderStudentListCsv(list) : new Uint8Array(await renderStudentListPdf(list));
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": query.format === "csv" ? "text/csv; charset=utf-8" : "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
