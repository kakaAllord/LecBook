import { ok, fail, handleApiError } from "@/lib/api-response";
import { requireAdmin, assertNotImpersonating } from "@/lib/auth";
import { parseLevelParam } from "@/lib/validators/module";
import { promoteSchema } from "@/lib/validators/student";
import { previewPromotion, promoteStudents } from "@/lib/services/student.service";
import { recordAudit } from "@/lib/audit";
import { levelLabel } from "@/lib/levels";

/** Everyone active at a level, with whether they passed it. */
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const level = parseLevelParam(new URL(request.url).searchParams.get("level"));
    if (!level) return fail("level must be 1, 2 or 3", 422);
    return ok(await previewPromotion(level));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Promotes the students the administrator confirmed. */
export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    assertNotImpersonating(session);
    const data = promoteSchema.parse(await request.json());
    const result = await promoteStudents(data.fromLevel, data.studentIds);

    await recordAudit(session, {
      action: "student.promote",
      entity: "Student",
      summary: `${session.name} promoted ${result.promoted} student${result.promoted === 1 ? "" : "s"} from ${levelLabel(data.fromLevel)} to ${result.to}`,
      metadata: { fromLevel: data.fromLevel, to: result.to, studentIds: data.studentIds, skipped: result.skipped },
    });

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
