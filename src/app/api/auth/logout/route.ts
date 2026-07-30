import { cookies } from "next/headers";
import { ok } from "@/lib/api-response";
import { AUTH_COOKIE } from "@/lib/auth";

export async function POST() {
  const store = await cookies();
  store.delete(AUTH_COOKIE);
  return ok({ loggedOut: true });
}
