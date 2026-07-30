import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleApiError } from "@/lib/api-response";
import { loginSchema } from "@/lib/validators/auth";
import { signToken, AUTH_COOKIE, AUTH_COOKIE_MAX_AGE } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return fail("Invalid email or password", 401);
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return fail("Invalid email or password", 401);
    }

    const token = signToken({ sub: user.id, email: user.email, name: user.name });

    const store = await cookies();
    store.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_COOKIE_MAX_AGE,
    });

    return ok({ id: user.id, name: user.name, email: user.email });
  } catch (error) {
    return handleApiError(error);
  }
}
