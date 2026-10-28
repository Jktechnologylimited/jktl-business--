import { guardAdminPage } from "@/lib/admin-page-guard";
import { requireAdminCapability } from "@/lib/admin-session";
import { can, ROLE_LABEL } from "@/lib/admin-permissions";
import { query } from "@/lib/custom/service";
import { InviteUser } from "@/components/mail/invite-user";
import { ActionForm } from "@/components/distribution/action-form";
import { manageTeamInvitationAction } from "@/lib/actions/team-invitation-actions";
import {
  resendAffiliateInviteAction,
  revokeProgramInvitationAction,
} from "@/lib/actions/affiliate-invitation-actions";
export const dynamic = "force-dynamic";
export default async function Page() {
  await guardAdminPage("compose_email");
  const a = await requireAdminCapability("compose_email"),
    team = can(a.role, "manage_team", a.permissions),
    program = can(a.role, "manage_affiliates", a.permissions);
  const settings = (
    await query("SELECT settings FROM email_branding WHERE id=true")
  )[0]?.settings as Record<string, unknown> | undefined;
  const hours = Number(settings?.invitationHours || 48);
  const roles = {
    ...(team ? ROLE_LABEL : {}),
    ...(program
      ? { "program:affiliate": "Affiliate", "program:partner": "Partner" }
      : {}),
  };
  const [policies, invitations] = await Promise.all([
    program
      ? query(
          "SELECT id,name,version,program FROM distribution_policies WHERE state='DRAFT' ORDER BY created_at DESC",
        )
      : Promise.resolve([]),
    query(
      `SELECT i.id,a.name,a.email,COALESCE(i.target_role,a.role) role,i.expires_at,i.accepted_at,i.revoked_at,i.sent_at,i.created_at,'team' kind,i.expires_at<=now() expired FROM editorial_invitations i JOIN admin_users a ON a.id=i.user_id WHERE $1::boolean
 UNION ALL SELECT id,name,email,program role,expires_at,accepted_at,revoked_at,sent_at,created_at,'program' kind,expires_at<=now() expired FROM affiliate_invitations WHERE $2::boolean ORDER BY created_at DESC LIMIT 100`,
      [team, program],
    ),
  ]);
  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-semibold">Invite User</h2>
      {Object.keys(roles).length ? (
        <InviteUser roles={roles} policies={policies} hours={hours} />
      ) : (
        <p>Your account cannot assign roles.</p>
      )}
      <h3>Invitations</h3>
      {invitations.map((i) => {
        const state = i.accepted_at
          ? "ACCEPTED"
          : i.revoked_at
            ? "REVOKED"
            : i.expired === true
              ? "EXPIRED"
              : "PENDING";
        return (
          <article
            key={String(i.kind) + String(i.id)}
            className="space-y-3 rounded-lg border border-border p-4"
          >
            <p>
              {String(i.name)} · {String(i.email)} · {String(i.role)} ·{" "}
              <strong>{state}</strong>
            </p>
            <p>
              Expires {String(i.expires_at)}
              {i.accepted_at ? " · Accepted " + String(i.accepted_at) : ""}.
              Provider submission {i.sent_at ? "accepted" : "not confirmed"}.
            </p>
            {!i.accepted_at && !i.revoked_at && (
              <div className="flex flex-wrap gap-3">
                <ActionForm
                  action={
                    i.kind === "team"
                      ? manageTeamInvitationAction
                      : resendAffiliateInviteAction
                  }
                >
                  <input type="hidden" name="id" value={String(i.id)} />
                  <input type="hidden" name="mode" value="RESEND" />
                  <input type="hidden" name="hours" value={hours} />
                  <button>Resend with a new secure link</button>
                </ActionForm>
                <ActionForm
                  action={
                    i.kind === "team"
                      ? manageTeamInvitationAction
                      : revokeProgramInvitationAction
                  }
                >
                  <input type="hidden" name="id" value={String(i.id)} />
                  <input type="hidden" name="mode" value="REVOKE" />
                  <button>Revoke invitation</button>
                </ActionForm>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
