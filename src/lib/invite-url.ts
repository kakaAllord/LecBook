/**
 * Builds the absolute invite link an admin hands to a new lecturer.
 *
 * Prefers APP_URL so links stay correct when generated behind a proxy, and
 * falls back to the incoming request's own origin in local development.
 */
export function buildInviteUrl(request: Request, token: string) {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  const base = configured || new URL(request.url).origin;
  return `${base.replace(/\/$/, "")}/invite/${token}`;
}
