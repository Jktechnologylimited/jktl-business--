import "server-only";
import { cookies } from "next/headers";
import { createAffiliateSession, destroyAffiliateSession, validateAffiliateSession } from "@/lib/db/affiliate-auth";
import type { AffiliateUser } from "@/lib/db/affiliate-auth";

// A third cookie name, scoped to its own path — same isolation trick as
// the admin session (see admin-session.ts): the browser never attaches
// this cookie to a /business/* or /admin/* request, and vice versa. Three
// separate credentials, three separate cookies, no shared code path.
const COOKIE_NAME = "jktl_affiliate_session";
/**
 * `/` rather than `/affiliates`, because the programme answers to two spellings.
 * With the cookie scoped to `/affiliates`, a partner who signed in via
 * `business.jktl.com.ng/affiliate/login` — the singular URL the marketing site
 * links to — would arrive at the dashboard without their session attached, and
 * be shown the public landing page while apparently signed in.
 */
const COOKIE_PATH = "/";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days, seconds

export async function startAffiliateSession(affiliateId: string): Promise<void> {
  const sessionId = await createAffiliateSession(affiliateId);
  const store = await cookies();
  store.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function endAffiliateSession(): Promise<void> {
  const store = await cookies();
  const sessionId = store.get(COOKIE_NAME)?.value;
  if (sessionId) await destroyAffiliateSession(sessionId);
  store.delete(COOKIE_NAME);
}

/** Returns null when there's no affiliate session — callers decide how to handle it. */
export async function getAffiliateSession(): Promise<AffiliateUser | null> {
  const store = await cookies();
  const sessionId = store.get(COOKIE_NAME)?.value;
  if (!sessionId) return null;
  return validateAffiliateSession(sessionId);
}

/** Throws when not signed in as an affiliate — the affiliate dashboard
 * layout redirects to /affiliates/login on this rather than letting it
 * surface as an error. */
export async function requireAffiliateSession(): Promise<AffiliateUser> {
  const affiliate = await getAffiliateSession();
  if (!affiliate) throw new Error("Not signed in as an affiliate.");
  return affiliate;
}
