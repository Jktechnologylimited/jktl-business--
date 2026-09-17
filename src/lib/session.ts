import "server-only";
import { cookies } from "next/headers";
import { createSession, destroySession, validateSession } from "@/lib/db/auth";

const COOKIE_NAME = "jktl_session";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, seconds

export async function startSession(userId: string, organizationId: string): Promise<void> {
  const sessionId = await createSession(userId, organizationId);
  const store = await cookies();
  store.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
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
