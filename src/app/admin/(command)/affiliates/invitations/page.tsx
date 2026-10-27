import { guardAdminPage } from "@/lib/admin-page-guard";
import { query } from "@/lib/custom/service";
import {
  inviteAffiliateAction,
  resendAffiliateInviteAction,
} from "@/lib/actions/affiliate-invitation-actions";
import { ActionForm } from "@/components/distribution/action-form";
export const dynamic = "force-dynamic";
export default async function Page() {
  await guardAdminPage("manage_affiliates");
  const policies = await query(
    "SELECT id,name,version FROM distribution_policies WHERE program='AFFILIATE' AND state='DRAFT' ORDER BY created_at DESC",
  );
  const invites = await query(
    "SELECT id,name,email,expires_at,accepted_at,sent_at FROM affiliate_invitations WHERE revoked_at IS NULL ORDER BY created_at DESC LIMIT 100",
  );
  return (
    <div className="space-y-5 text-ink">
      <h1 className="text-3xl font-semibold">Invite an Affiliate</h1>
      <p>
        Invitations use the recipient’s existing Business account or ordinary
        signup. Proposed 15% policies remain draft until formally approved;
        invitations do not activate financial terms.
      </p>
      <ActionForm action={inviteAffiliateAction} className="grid gap-3">
        <label>
          Full name
          <input
            className="block w-full rounded border border-border bg-paper p-3"
            name="name"
            required
            maxLength={120}
          />
        </label>
        <label>
          Email
          <input
            className="block w-full rounded border border-border bg-paper p-3"
            name="email"
            type="email"
            required
          />
        </label>
        <label>
          Proposed policy
          <select
            className="block w-full rounded border border-border bg-paper p-3"
            name="policy"
            required
          >
            {policies.map((p) => (
              <option key={String(p.id)} value={String(p.id)}>
                {String(p.name)} · v{String(p.version)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Invitation message
          <textarea
            className="block w-full rounded border border-border bg-paper p-3"
            name="message"
            maxLength={2000}
          />
        </label>
        <button className="rounded bg-primary p-3 text-on-primary">
          Send secure invitation
        </button>
      </ActionForm>
      {invites.map((i) => (
        <article
          key={String(i.id)}
          className="space-y-3 rounded border border-border p-4"
        >
          <h2>
            {String(i.name)} · {String(i.email)}
          </h2>
          <p>
            {i.accepted_at
              ? "Accepted"
              : i.sent_at
                ? "Email accepted by provider"
                : "Email pending"}{" "}
            · expires{" "}
            {new Date(String(i.expires_at)).toLocaleDateString("en-NG")}
          </p>
          {!i.accepted_at && new Date(String(i.expires_at)) > new Date() && (
            <ActionForm action={resendAffiliateInviteAction}>
              <input name="id" type="hidden" value={String(i.id)} />
              <button className="underline">
                Resend with a new secure link
              </button>
            </ActionForm>
          )}
        </article>
      ))}
    </div>
  );
}
