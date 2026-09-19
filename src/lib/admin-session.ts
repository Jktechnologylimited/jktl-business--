import "server-only";
import { cookies } from "next/headers";
import { createAdminSession, destroyAdminSession, validateAdminSession } from "@/lib/db/admin-auth";
import type { AdminUser } from "@/lib/db/admin-auth";

// Deliberately a different cookie name from the business session
// ("jktl_session") AND scoped to the /admin path — the browser will never
// even attach this cookie to a request for /business/* or an API route
// used by a business account, and vice versa. Two separate credentials,
// two separate cookies, no shared code path between them.
const COOKIE_NAME = "jktl_admin_session";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days, seconds

export async function startAdminSession(adminUserId: string): Promise<void> {
  const sessionId = await createAdminSession(adminUserId);
  const store = await cookies();
  store.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function endAdminSession(): Promise<void> {
  const store = await cookies();
  const sessionId = store.get(COOKIE_NAME)?.value;
  if (sessionId) await destroyAdminSession(sessionId);
  store.delete(COOKIE_NAME);
}

/** Returns null when there's no admin session — callers decide how to handle it. */
export async function getAdminSession(): Promise<AdminUser | null> {
  const store = await cookies();
  const sessionId = store.get(COOKIE_NAME)?.value;
  if (!sessionId) return null;
  return validateAdminSession(sessionId);
}

/** Throws when not signed in as an admin — the `/admin` layout redirects
 * to `/admin/login` on this rather than letting it surface as an error. */
export async function requireAdminSession(): Promise<AdminUser> {
  const admin = await getAdminSession();
  if (!admin) throw new Error("Not signed in as admin.");
  return admin;
}
