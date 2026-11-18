import { ok, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { listTeachingUnits } from "@/lib/services/teaching.service";

/**
 * Every module at every level this account can work with, each labelled
 * "Electrical Installation Level I" with the courses it covers. This is what
 * every module picker outside the Modules page is filled from.
 */
export async function GET() {
  try {
    const session = await requireSession();
    return ok(await listTeachingUnits(session));
  } catch (error) {
    return handleApiError(error);
  }
}
