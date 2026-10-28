"use server";
import { limitInvitationRequest } from "@/lib/mail/invitation-rate";
import { requireAdminCapability, getAdminSession } from "@/lib/admin-session";
import { getSession } from "@/lib/session";
import { query } from "@/lib/custom/service";
import { rate } from "@/lib/support/service";
import {
  createTeamInvitation,
  invitationRole,
  inviteHash,
  inspectTeamInvitation,
  acceptTeamInvitation,
} from "@/lib/mail/invitations";
import { sendRoleInvitationEmail } from "@/lib/email";
import { ROLE_LABEL } from "@/lib/admin-permissions";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
export async function inviteTeamUserAction(f: FormData) {
  const actor = await requireAdminCapability("manage_team");
  await rate("role-invite:" + actor.id, 10);
  const role = invitationRole(f.get("role"));
  const result = await createTeamInvitation(query, actor.id, {
    name: String(f.get("name") || ""),
    email: String(f.get("email") || "")
      .trim()
      .toLowerCase(),
    message: String(f.get("message") || ""),
    role,
    hours: Number(f.get("hours") || 48),
  });
  const sent = await sendRoleInvitationEmail({
    to: result.email,
    name: String(f.get("name")),
    role: ROLE_LABEL[role],
    message: String(f.get("message") || ""),
    url: "https://business.jktl.com.ng/admin/invitation?token=" + result.token,
    expiresAt: result.expiresAt,
    key: "team-invite-" + result.id,
    editorial: role === "writer" || role === "editor",
  });
  if (sent.ok)
    await query("UPDATE editorial_invitations SET sent_at=now() WHERE id=$1", [
      result.id,
    ]);
  revalidatePath("/admin/emails/invite");
  if (!sent.ok)
    throw Error(
      "Invitation saved. Email submission was not confirmed; rotate the invitation with resend before trying again.",
    );
}
export async function manageTeamInvitationAction(f: FormData) {
  const actor = await requireAdminCapability("manage_team");
  await rate("role-invite:" + actor.id, 10);
  const id = String(f.get("id")),
    mode = String(f.get("mode"));
  if (!/^[a-f0-9-]{36}$/i.test(id) || !["RESEND", "REVOKE"].includes(mode))
    throw Error("Choose a valid invitation action.");
  if (mode === "REVOKE") {
    await query(
      "WITH changed AS(UPDATE editorial_invitations SET revoked_at=now() WHERE id=$1 AND accepted_at IS NULL AND revoked_at IS NULL RETURNING id) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $2,'TEAM_INVITATION_REVOKED',jsonb_build_object('invitation',id) FROM changed",
      [id, actor.id],
    );
  } else {
    const token = randomBytes(32).toString("hex"),
      hours = Number(f.get("hours") || 48);
    if (!Number.isInteger(hours) || hours < 1 || hours > 168)
      throw Error("Choose 1–168 hours.");
    const row = (
      await query(
        "UPDATE editorial_invitations i SET token_hash=$2,expires_at=now()+$3::int*interval '1 hour',sent_at=NULL FROM admin_users a WHERE i.id=$1 AND a.id=i.user_id AND i.accepted_at IS NULL AND i.revoked_at IS NULL RETURNING i.*,a.email,COALESCE(i.target_role,a.role) assigned_role",
        [id, inviteHash(token), hours],
      )
    )[0];
    if (!row) throw Error("This invitation cannot be resent.");
    const role = invitationRole(row.assigned_role);
    const sent = await sendRoleInvitationEmail({
      to: String(row.email),
      name: String(row.name || "there"),
      role: ROLE_LABEL[role],
      message: String(row.message),
      url: "https://business.jktl.com.ng/admin/invitation?token=" + token,
      expiresAt: new Date(String(row.expires_at)).toISOString(),
      key: "team-invite-" + row.id + "-" + inviteHash(token).slice(0, 12),
      editorial: role === "writer" || role === "editor",
    });
    if (!sent.ok)
      throw Error(
        "Provider submission was not confirmed. The previous link is invalid; use resend to rotate it again.",
      );
    await query(
      "WITH changed AS(UPDATE editorial_invitations SET sent_at=now() WHERE id=$1 RETURNING id) INSERT INTO distribution_audit(actor_id,event,detail) SELECT $2,'TEAM_INVITATION_RESENT',jsonb_build_object('invitation',id) FROM changed",
      [id, actor.id],
    );
  }
  revalidatePath("/admin/emails/invite");
}
export async function acceptTeamUserInvitationAction(f: FormData) {
  const token = String(f.get("token") || "");
  if (!/^[a-f0-9]{64}$/.test(token) || f.get("consent") !== "on")
    throw Error("Review and accept the invitation terms.");
  await limitInvitationRequest("accept");
  await rate("team-accept:" + inviteHash(token), 8);
  const invitation = await inspectTeamInvitation(query, token);
  if (!invitation) throw Error("Invitation unavailable.");
  const business = await getSession(),
    team = await getAdminSession();
  let passwordHash: string | undefined;
  if (invitation.accept_mode === "NEW_TEAM" && !invitation.business_exists) {
    const password = String(f.get("password") || "");
    if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72)
      throw Error(
        "Choose a password of at least 12 characters and at most 72 bytes.",
      );
    passwordHash = await bcrypt.hash(password, 12);
  }
  const accepted = await acceptTeamInvitation(query, token, {
    businessId: business?.userId,
    teamId: team?.id,
    passwordHash,
  });
  redirect(accepted.business_user_id ? "/admin" : "/admin/login");
}
