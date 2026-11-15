import "server-only";
import { cookies } from "next/headers";
import { createSession, destroySession, validateSession } from "@/lib/db/auth";
import { linkedBusinessStaff, destroyAdminSession } from "@/lib/db/admin-auth";

const COOKIE_NAME = "jktl_session";

export async function startSession(userId: string, organizationId: string): Promise<void> {
  // Keep the shorter Team sign-in lifetime when one credential opens both apps.
  const days = await linkedBusinessStaff(userId) ? 7 : 30;
  const sessionId = await createSession(userId, organizationId, days);
  const store = await cookies();
  const nativeTeam = store.get("jktl_admin_session")?.value;
  if (nativeTeam) {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nativeTeam))
      await destroyAdminSession(nativeTeam);
    store.set("jktl_admin_session", "", { path: "/admin", maxAge: 0 });
  }
  store.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: days * 24 * 60 * 60,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const sessionId = store.get(COOKIE_NAME)?.value;
  if (sessionId) await destroySession(sessionId);
  store.delete(COOKIE_NAME);
}

/** Returns null when there's no session — callers decide how to handle it. */
export async function getSession(): Promise<{ userId: string; organizationId: string } | null> {
  const store = await cookies();
  const sessionId = store.get(COOKIE_NAME)?.value;
  if (!sessionId) return null;
  return validateSession(sessionId);
}

/** Throws when unauthenticated — every mutating Server Action starts with this.
 * Never trust an organizationId from the client; it always comes from here. */
export async function requireSession(): Promise<{ userId: string; organizationId: string }> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return session;
}
