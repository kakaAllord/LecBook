import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import type { UserRole } from "@prisma/client";
import { ApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import {
  AUTH_COOKIE,
  AUTH_COOKIE_MAX_AGE,
  IMPERSONATION_COOKIE,
  IMPERSONATION_MAX_AGE,
} from "@/lib/auth-cookie";

export {
  AUTH_COOKIE,
  AUTH_COOKIE_MAX_AGE,
  IMPERSONATION_COOKIE,
  IMPERSONATION_MAX_AGE,
} from "@/lib/auth-cookie";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return secret;
}

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  /** UserSession id, used for device/usage metrics. */
  sid?: string;
};

/** A resolved session, including who is really behind it when impersonating. */
export type Session = SessionPayload & {
  /** Super admin id when this session is a "view as user" session. */
  impersonatedById?: string;
  impersonatorName?: string;
};

type ImpersonationPayload = {
  actorId: string;
  actorName: string;
  targetId: string;
};

export function signToken(payload: SessionPayload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: AUTH_COOKIE_MAX_AGE });
}

export function verifyToken(token: string): SessionPayload {
  return jwt.verify(token, getJwtSecret()) as SessionPayload;
}

export function signImpersonationToken(payload: ImpersonationPayload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: IMPERSONATION_MAX_AGE });
}

function verifyImpersonationToken(token: string): ImpersonationPayload {
  return jwt.verify(token, getJwtSecret()) as ImpersonationPayload;
}

/**
 * Resolves the acting session. When a valid impersonation cookie is present and
 * the real user is a super admin, the returned session is the *target* user's —
 * so every downstream page, query and permission check behaves exactly as it
 * would for that user — with the super admin recorded in `impersonatedById`.
 */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (!token) return null;

  let base: SessionPayload;
  try {
    base = verifyToken(token);
  } catch {
    return null;
  }

  const impersonationToken = store.get(IMPERSONATION_COOKIE)?.value;
  if (!impersonationToken) return base;

  try {
    const view = verifyImpersonationToken(impersonationToken);
    // Only the super admin who started the session may keep using it.
    if (view.actorId !== base.sub || base.role !== "SUPER_ADMIN") return base;

    const target = await prisma.user.findUnique({
      where: { id: view.targetId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!target) return base;

    return {
      sub: target.id,
      email: target.email,
      name: target.name,
      role: target.role,
      impersonatedById: view.actorId,
      impersonatorName: view.actorName,
    };
  } catch {
    return base;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    throw new ApiError("Not authenticated", 401);
  }
  return session;
}

export async function requireRole(...roles: UserRole[]): Promise<Session> {
  const session = await requireSession();
  if (!roles.includes(session.role)) {
    throw new ApiError("You do not have permission to do that", 403);
  }
  return session;
}

/** Admins and super admins — the accounts that manage people and academic data. */
export function requireAdmin() {
  return requireRole("ADMIN", "SUPER_ADMIN");
}

export function requireSuperAdmin() {
  return requireRole("SUPER_ADMIN");
}

export function isAdminRole(role: UserRole) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/**
 * Blocks writes performed while viewing as another user. Read-only impersonation
 * keeps the audit trail honest: a super admin inspecting an account cannot
 * silently change that account's data.
 */
export function assertNotImpersonating(session: Session) {
  if (session.impersonatedById) {
    throw new ApiError(
      "You are viewing this account read-only. Exit view-as mode to make changes.",
      403
    );
  }
}

export const IMPERSONATION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: IMPERSONATION_MAX_AGE,
};

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: AUTH_COOKIE_MAX_AGE,
};
