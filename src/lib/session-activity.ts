import { prisma } from "@/lib/prisma";

const TOUCH_INTERVAL_MS = 5 * 60_000;

// Throttle in memory so a busy page doesn't turn every API call into a write.
// Per-instance state is fine here: the worst case is one extra update per
// serverless instance per interval, and the metric it feeds is a daily rollup.
const lastTouched = new Map<string, number>();

/**
 * Advances a device session's `lastSeenAt` so active-user metrics measure real
 * usage rather than just the moment someone signed in. Fire-and-forget: a failed
 * heartbeat must never surface as a request error.
 */
export function touchSession(sessionId: string | undefined) {
  if (!sessionId) return;

  const now = Date.now();
  const previous = lastTouched.get(sessionId);
  if (previous && now - previous < TOUCH_INTERVAL_MS) return;
  lastTouched.set(sessionId, now);

  void prisma.userSession
    .updateMany({ where: { id: sessionId }, data: { lastSeenAt: new Date() } })
    .catch(() => {
      // A dropped heartbeat costs a little metric precision and nothing else.
    });
}
