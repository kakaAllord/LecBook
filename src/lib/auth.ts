import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { ApiError } from "@/lib/api-response";
import { AUTH_COOKIE, AUTH_COOKIE_MAX_AGE } from "@/lib/auth-cookie";

export { AUTH_COOKIE, AUTH_COOKIE_MAX_AGE } from "@/lib/auth-cookie";

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
};

export function signToken(payload: SessionPayload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: AUTH_COOKIE_MAX_AGE });
}

export function verifyToken(token: string): SessionPayload {
  return jwt.verify(token, getJwtSecret()) as SessionPayload;
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new ApiError("Not authenticated", 401);
  }
  return session;
}
