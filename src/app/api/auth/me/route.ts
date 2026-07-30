import { prisma } from "@/lib/prisma";
import { ok, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.sub },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    return ok(user);
  } catch (error) {
    return handleApiError(error);
  }
}
