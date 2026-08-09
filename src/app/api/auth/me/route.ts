import { prisma } from "@/lib/prisma";
import { ok, handleApiError } from "@/lib/api-response";
import { requireSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        phone: true,
        title: true,
        createdAt: true,
        lastLoginAt: true,
        modules: { select: { id: true, name: true } },
      },
    });
    return ok({
      ...user,
      impersonatedBy: session.impersonatedById
        ? { id: session.impersonatedById, name: session.impersonatorName ?? "Super Admin" }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
