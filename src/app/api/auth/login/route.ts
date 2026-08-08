import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleApiError } from "@/lib/api-response";
import { loginSchema } from "@/lib/validators/auth";
import { signToken, AUTH_COOKIE, AUTH_COOKIE_OPTIONS, IMPERSONATION_COOKIE } from "@/lib/auth";
import { parseUserAgent, getClientIp } from "@/lib/device";
import { recordAudit, recordAnonymousAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      await recordAnonymousAudit(
        { name: "Unknown", email },
        {
          action: "auth.login_failed",
          entity: "User",
          summary: `Failed sign-in attempt for ${email}`,
        }
      );
      return fail("Invalid email or password", 401);
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      await recordAnonymousAudit(
        { name: user.name, email },
        {
          action: "auth.login_failed",
          entity: "User",
          entityId: user.id,
          summary: `Failed sign-in attempt for ${email}`,
        }
      );
      return fail("Invalid email or password", 401);
    }

    if (user.status === "INACTIVE") {
      return fail("This account has been deactivated. Contact your administrator.", 403);
    }
    if (user.status === "PENDING") {
      return fail("Finish setting up your account using the invite link you were sent.", 403);
    }

    const userAgent = request.headers.get("user-agent");
    const device = parseUserAgent(userAgent);

    const [session] = await prisma.$transaction([
      prisma.userSession.create({
        data: {
          userId: user.id,
          ip: getClientIp(request),
          userAgent,
          deviceType: device.deviceType,
          browser: device.browser,
          os: device.os,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
      }),
    ]);

    const token = signToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sid: session.id,
    });

    const store = await cookies();
    store.set(AUTH_COOKIE, token, AUTH_COOKIE_OPTIONS);
    // A fresh sign-in always starts as yourself, never inside a stale view-as session.
    store.delete(IMPERSONATION_COOKIE);

    await recordAudit(
      { sub: user.id, name: user.name, email: user.email, role: user.role },
      {
        action: "auth.login",
        entity: "User",
        entityId: user.id,
        summary: `${user.name} signed in`,
        metadata: { device: device.deviceType, browser: device.browser, os: device.os },
      }
    );

    return ok({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (error) {
    return handleApiError(error);
  }
}
