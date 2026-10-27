"use server";
import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { requireAdminCapability } from "@/lib/admin-session";
import { getSql } from "@/lib/db/client";
import { sendEditorialInvitation } from "@/lib/email";
import { rate } from "@/lib/support/service";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
export async function inviteEditorialAction(f: FormData) {
  const a = await requireAdminCapability("manage_team");
  await rate("editorial-invite:" + a.id, 10);
  const name = String(f.get("name") || "").trim(),
    email = String(f.get("email") || "")
      .trim()
      .toLowerCase(),
    role = String(f.get("role"));
  if (
    !name ||
    name.length > 100 ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    email.length > 254 ||
    !["writer", "editor"].includes(role)
  )
    throw Error("Check the name, email and editorial role.");
  const token = randomBytes(32).toString("hex"),
    hash = createHash("sha256").update(token).digest("hex");
  const rows = await getSql().query(
    `WITH added AS(INSERT INTO admin_users(name,email,password_hash,role,created_by,disabled_at) VALUES($1,$2,'!editorial-invitation-pending',$3,$4,now()) ON CONFLICT(email) DO NOTHING RETURNING id),invited AS(INSERT INTO editorial_invitations(user_id,token_hash,expires_at,created_by) SELECT id,$5,now()+interval '7 days',$4 FROM added RETURNING id,user_id),logged AS(INSERT INTO distribution_audit(actor_id,event,detail) SELECT $4,'EDITORIAL_INVITED',jsonb_build_object('member',user_id,'role',$3::text) FROM invited) SELECT * FROM invited`,
    [name, email, role, a.id, hash],
  );
  if (!rows.length)
    throw Error(
      "That email already has a team account. Manage its existing access in Team.",
    );
  const url = "https://business.jktl.com.ng/admin/invitation?token=" + token;
  const result = await sendEditorialInvitation(
    email,
    name,
    url,
    String(rows[0].id),
  );
  revalidatePath("/admin/team");
  // Owner-only recovery link: provider failures do not leave the invitation inaccessible.
  return { url, emailSent: result.ok };
}
export async function acceptEditorialInvitationAction(f: FormData) {
  const token = String(f.get("token") || ""),
    password = String(f.get("password") || "");
  if (
    !/^[0-9a-f]{64}$/.test(token) ||
    password.length < 12 ||
    password.length > 128
  )
    throw Error("Use a valid invitation and a password of 12–128 characters.");
  const hash = createHash("sha256").update(token).digest("hex");
  await rate("editorial-accept:" + hash, 8);
  const pw = await bcrypt.hash(password, 12);
  const rows = await getSql().query(
    `WITH accepted AS(UPDATE editorial_invitations i SET accepted_at=now() FROM admin_users u WHERE i.token_hash=$1 AND i.accepted_at IS NULL AND i.expires_at>now() AND u.id=i.user_id AND u.password_hash='!editorial-invitation-pending' AND u.staff_revoked_at IS NULL AND u.role IN('writer','editor') RETURNING i.user_id),enabled AS(UPDATE admin_users SET password_hash=$2,disabled_at=NULL WHERE id IN(SELECT user_id FROM accepted) RETURNING id),logged AS(INSERT INTO distribution_audit(actor_id,event,detail) SELECT id,'EDITORIAL_INVITATION_ACCEPTED','{}'::jsonb FROM enabled) SELECT id FROM enabled`,
    [hash, pw],
  );
  if (!rows.length)
    throw Error(
      "This invitation expired or was already used. Ask the JKTL team for help.",
    );
  redirect("/admin/login");
}
