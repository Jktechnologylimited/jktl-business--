"use server";

import * as db from "@/lib/db/members";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "./types";
import type { OrganizationMember } from "@/lib/types";

export async function addMemberAction(id: string, input: db.MemberInput): Promise<ActionResult<OrganizationMember>> {
  try {
    const { organizationId } = await requireSession();
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
