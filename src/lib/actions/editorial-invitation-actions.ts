"use server";
import {
  inviteTeamUserAction,
  acceptTeamUserInvitationAction,
} from "./team-invitation-actions";
/** Compatibility entry points use the same central invitation implementation. */
export async function inviteEditorialAction(f: FormData) {
  if (!["writer", "editor"].includes(String(f.get("role"))))
    throw Error("Choose an editorial role.");
  await inviteTeamUserAction(f);
  return { url: "/admin/emails/invite", emailSent: true };
}
export async function acceptEditorialInvitationAction(f: FormData) {
  return acceptTeamUserInvitationAction(f);
}
