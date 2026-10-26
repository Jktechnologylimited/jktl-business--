import "server-only";
import { cookies } from "next/headers";
import {
  createAdminSession,
  destroyAdminSession,
  validateAdminSession,
} from "@/lib/db/admin-auth";
import type { AdminUser } from "@/lib/db/admin-auth";
import { getSession, endSession } from "@/lib/session";
import { linkedBusinessStaff } from "@/lib/db/admin-auth";
import { getSql } from "@/lib/db/client";
import { ROLE_LABEL, can, type AdminCapability } from "@/lib/admin-permissions";

// Deliberately a different cookie name from the business session
// ("jktl_session") AND scoped to the /admin path — the browser will never
// even attach this cookie to a request for /business/* or an API route
// used by a business account, and vice versa. Two separate credentials,
// two separate cookies. Assigned Growth staff may instead use a current Business
// session and an explicitly linked staff profile; email matching never grants access.
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
  const linkedStaff = await getAdminSession();
  if (sessionId) await destroyAdminSession(sessionId);
  store.delete(COOKIE_NAME);
  if (linkedStaff?.role === "growth_gaming_lead") await endSession();
}

/** Returns null when there's no admin session — callers decide how to handle it. */
export async function getAdminSession(): Promise<AdminUser | null> {
  const store = await cookies();
  const sessionId = store.get(COOKIE_NAME)?.value;
  if (sessionId) {
    const admin = await validateAdminSession(sessionId);
    if (admin) return admin;
  }
  const business = await getSession();
  return business ? linkedBusinessStaff(business.userId) : null;
}

/** Throws when not signed in as an admin — the `/admin` layout redirects
 * to `/admin/login` on this rather than letting it surface as an error. */
export async function requireAdminSession(): Promise<AdminUser> {
  const admin = await getAdminSession();
  if (!admin) throw new Error("Not signed in to a team account.");
  return admin;
}

/**
 * Requires an admin whose role allows this capability.
 *
 * Every state-changing admin action calls one of these, not just the page it sits
 * on. Hiding a button is a UI courtesy; this is the check that actually stops an
 * analyst recording a payout by posting to the action directly.
 */
export async function requireAdminCapability(
  capability: AdminCapability,
): Promise<AdminUser> {
  const admin = await requireAdminSession();
  if (!can(admin.role, capability, admin.permissions)) {
    await getSql()
      .query(
        "INSERT INTO distribution_audit(actor_id,event,detail) VALUES($1,'STAFF_ACCESS_DENIED',$2::jsonb)",
        [admin.id, JSON.stringify({ capability, role: admin.role })],
      )
      .catch(() => {});
    throw new Error(
      `Your role (${ROLE_LABEL[admin.role]}) cannot ${capability.replace(/_/g, " ")}.`,
    );
  }
  return admin;
}

/** True when the signed-in admin lacks a capability — for rendering, not for
 * enforcement. */
export function lacks(
  admin: AdminUser | null,
  capability: AdminCapability,
): boolean {
  if (!admin) return true;
  return !can(admin.role, capability, admin.permissions);
}
