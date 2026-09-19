"use server";

import * as db from "@/lib/db/members";
import { isSubscriptionActive } from "@/lib/db/billing";
import { requireSession } from "@/lib/session";
import { FREE_TEAM_SEATS } from "@/lib/billing";
import type { ActionResult } from "./types";
import type { OrganizationMember } from "@/lib/types";

/**
 * The free tier includes just the owner (seeded at signup); adding a 2nd+
 * team member needs an active Website & Hosting subscription. This is the
 * authoritative check — team-member adds go through the offline outbox
 * (see `addMember` in `src/lib/store.ts`), so a business at the limit can
 * still *try* to add someone while offline; this runs once the mutation
 * reaches the server, and a rejection here surfaces as the generic
 * "couldn't be saved and was discarded" toast the outbox already shows for
 * any rejected mutation. The Settings → Users tab also checks this
 * up front so that's the rare path, not the common one.
 */
export async function addMemberAction(id: string, input: db.MemberInput): Promise<ActionResult<OrganizationMember>> {
  try {
    const { organizationId } = await requireSession();

    const count = await db.countMembers(organizationId);
    if (count >= FREE_TEAM_SEATS) {
      const active = await isSubscriptionActive(organizationId);
      if (!active) {
        return { ok: false, error: "Upgrade to Website & Hosting under Settings → Plan to add more team members." };
      }
    }

    return { ok: true, data: await db.addMember(organizationId, id, input) };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't add this team member." };
  }
}

export async function removeMemberAction(id: string): Promise<ActionResult<null>> {
  try {
    const { organizationId } = await requireSession();
    await db.removeMember(organizationId, id);
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't remove this team member." };
  }
}
