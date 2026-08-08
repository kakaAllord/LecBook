import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Session } from "@/lib/auth";

export type AuditAction =
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "auth.invite_accepted"
  | "user.create"
  | "user.update"
  | "user.activate"
  | "user.deactivate"
  | "user.delete"
  | "user.invite_created"
  | "user.invite_revoked"
  | "user.impersonate_start"
  | "user.impersonate_end"
  | "student.create"
  | "student.update"
  | "student.delete"
  | "student.export"
  | "course.create"
  | "course.update"
  | "course.delete"
  | "module.create"
  | "module.update"
  | "module.delete"
  | "attendance.save"
  | "attendance.move"
  | "attendance.delete"
  | "assessment.create"
  | "assessment.update"
  | "assessment.delete"
  | "assessment.marks_save"
  | "report.download"
  | "settings.update";

type AuditInput = {
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
};

type Actor = Pick<Session, "sub" | "name" | "email" | "role"> & {
  impersonatedById?: string;
};

/**
 * Writes one line of the activity trail. Audit failures must never break the
 * action being audited, so every error is swallowed and logged instead.
 */
export async function recordAudit(actor: Actor | null, input: AuditInput) {
  try {
    let ip: string | null = null;
    let userAgent: string | null = null;
    try {
      const h = await headers();
      ip = h.get("x-forwarded-for")?.split(",")[0].trim() ?? h.get("x-real-ip") ?? null;
      userAgent = h.get("user-agent");
    } catch {
      // Outside a request context (scripts, seeds) — headers are unavailable.
    }

    await prisma.auditLog.create({
      data: {
        // Empty sub means an actor with no account row yet (e.g. a failed login).
        userId: actor?.sub || null,
        actorName: actor?.name ?? "System",
        actorEmail: actor?.email ?? "system",
        actorRole: actor?.role ?? "SUPER_ADMIN",
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary,
        metadata: input.metadata,
        ip,
        userAgent,
        impersonatedById: actor?.impersonatedById ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}

/** Records an audited event for someone who has no session yet (failed logins). */
export async function recordAnonymousAudit(
  identity: { name: string; email: string },
  input: AuditInput
) {
  await recordAudit(
    { sub: "", name: identity.name, email: identity.email, role: "LECTURER" },
    input
  );
}
