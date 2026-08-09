import { ok, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";
import { getAdminDashboard, getLecturerDashboard } from "@/lib/services/dashboard.service";

export async function GET() {
  try {
    const session = await requireSession();
    // A lecturer's dashboard answers "how are my students doing"; an admin's
    // answers "what does the institution look like". They are different reads,
    // not the same read with different numbers.
    return ok(
      session.role === "LECTURER"
        ? await getLecturerDashboard(session)
        : await getAdminDashboard()
    );
  } catch (error) {
    return handleApiError(error);
  }
}
