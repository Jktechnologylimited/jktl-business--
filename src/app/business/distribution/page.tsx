import Link from "next/link";
import { acceptPartnerQuoteAction } from "@/lib/actions/distribution-program-actions";
import { ActionForm } from "@/components/distribution/action-form";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { query } from "@/lib/custom/service";
import { createHash } from "node:crypto";
import {
  connectProgramAction,
  openProgramAction,
  unlinkProgramAction,
  acceptPartnerInviteAction,
  revokePartnerAccessAction,
} from "@/lib/actions/partner-client-actions";
import { validInviteToken, CLIENT_SCOPES } from "@/lib/distribution/access";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  const s = await getSession();
  if (!s)
    redirect(
      "/login?next=distribution" +
        (invite && validInviteToken(invite) ? "&invite=" + invite : ""),
    );
  const [links, access, members] = await Promise.all([
    query(
      "SELECT l.program,a.name,a.status,a.application_stage,a.applicant_message FROM distribution_account_links l JOIN affiliates a ON a.id=l.affiliate_id WHERE l.user_id=$1",
      [s.userId],
    ),
    query(
      "SELECT r.id,r.scopes,r.revoked_at,a.name FROM partner_client_access r JOIN affiliates a ON a.id=r.partner_id WHERE r.organization_id=$1 ORDER BY r.created_at DESC",
      [s.organizationId],
    ),
    query(
      "SELECT 1 FROM organization_members WHERE user_id=$1 AND organization_id=$2 AND active=true AND role='owner'",
      [s.userId, s.organizationId],
    ),
  ]);
  const isOwner = members.length > 0;
  const quotes = isOwner
    ? await query(
        `SELECT q.id,q.amount_kobo,q.scope,q.billing_party,q.status,q.expires_at FROM partner_commercial_quotes q JOIN partner_service_requests r ON r.id=q.request_id JOIN partner_client_access x ON x.id=r.relationship_id WHERE x.revoked_at IS NULL AND(q.billing_party='CUSTOMER' AND x.organization_id=$1 OR q.billing_party='PARTNER' AND EXISTS(SELECT 1 FROM distribution_account_links l WHERE l.user_id=$2 AND l.affiliate_id=x.partner_id)) ORDER BY q.created_at DESC LIMIT 50`,
        [s.organizationId, s.userId],
      )
    : [];
  let invitation;
  if (invite && validInviteToken(invite))
    invitation = (
      await query(
        `SELECT a.name,i.label FROM partner_client_invitations i JOIN affiliates a ON a.id=i.partner_id WHERE token_hash=$1 AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND expires_at>now() AND a.status='active' AND a.programme='partner' AND a.partner_terms_confirmed=true`,
        [createHash("sha256").update(invite).digest("hex")],
      )
    )[0];
  const input = "w-full rounded-lg border border-border bg-paper p-3";
  return (
    <div className="space-y-6 text-ink">
      <h1 className="text-3xl font-semibold">Programs & partner access</h1>
      <Link className="underline" href="/business/programs/apply">
        Apply to Affiliates or Partners with this Business account
      </Link>
      {quotes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">
            Service quotes for your approval
          </h2>
          {quotes.map((q) => (
            <article
              key={String(q.id)}
              className="space-y-3 rounded-xl border border-border p-5"
            >
              <strong>
                ₦{(Number(q.amount_kobo) / 100).toLocaleString("en-NG")} ·{" "}
                {String(q.status)} · Billing: {String(q.billing_party)}
              </strong>
              <p className="whitespace-pre-wrap">{String(q.scope)}</p>
              <p className="text-sm">
                Acceptance authorizes the agreed scope and billing
                responsibility. It does not itself make a payment, create a
                subscription or confirm provisioning.
              </p>
              {q.status === "OFFERED" && (
                <ActionForm
                  action={acceptPartnerQuoteAction}
                  className="space-y-3"
                >
                  <input type="hidden" name="id" value={String(q.id)} />
                  <label>
                    <input type="checkbox" name="consent" required />I accept
                    these exact terms as the authorized owner of the billing
                    business.
                  </label>
                  <button className="rounded-lg border border-border p-3">
                    Accept quote
                  </button>
                </ActionForm>
              )}
            </article>
          ))}
        </section>
      )}

      <p className="text-ink-muted">
        Open your approved Affiliate or Partner dashboard using your Business
        session. Your business belongs to you; granting a partner access never
        transfers ownership.
      </p>
      {invite && (
        <section className="rounded-xl border border-border bg-paper p-5">
          {invitation ? (
            <>
              <h2 className="text-xl font-semibold">
                Invitation from {String(invitation.name)}
              </h2>
              <p className="my-3">
                Accept for your current business only. Select the permissions
                you want to grant; nothing is selected by default. Partners
                cannot make payments or access private business records through
                this connection.
              </p>
              {isOwner ? (
                <form action={acceptPartnerInviteAction} className="space-y-4">
                  <input type="hidden" name="token" value={invite} />
                  {CLIENT_SCOPES.map((scope) => (
                    <label key={scope} className="flex gap-3">
                      <input type="checkbox" name="scopes" value={scope} />
                      {scope === "MANAGE_WEBSITE_CONTENT"
                        ? "Edit website content for this business"
                        : scope === "PUBLISH_WEBSITE"
                          ? "Publish this business website"
                          : scope === "VIEW_ALLOWED_SERVICES"
                            ? "View the services you authorize"
                            : "Request service assistance from JKTL on your behalf"}
                    </label>
                  ))}
                  <label className="flex gap-3">
                    <input type="checkbox" required name="consent" />I authorize
                    this relationship for my current business and can revoke it
                    here. If this is a new, unpaid business without an existing
                    referrer, this partner may receive a commission on eligible
                    purchases under an active referral agreement. Your prices do
                    not increase.
                  </label>
                  <button className="rounded-lg bg-primary p-3 text-on-primary">
                    Accept invitation
                  </button>
                </form>
              ) : (
                <p>Only the current business owner can accept.</p>
              )}
            </>
          ) : (
            <p>This invitation is unavailable or has expired.</p>
          )}
        </section>
      )}
      <section className="rounded-xl border border-border bg-paper p-5">
        <h2 className="text-xl font-semibold">Connected program accounts</h2>
        {links.map((l) => (
          <div
            key={String(l.program)}
            className="my-4 flex flex-wrap items-center gap-4"
          >
            <p>
              {String(l.name)} · {String(l.program)} · {String(l.status)} ·{" "}
              {String(l.application_stage || "")}{" "}
              {String(l.applicant_message || "")}
            </p>
            <form action={openProgramAction}>
              <input type="hidden" name="program" value={String(l.program)} />
              <button className="rounded-lg border border-border p-3">
                Open dashboard
              </button>
            </form>
            <form action={unlinkProgramAction}>
              <input type="hidden" name="program" value={String(l.program)} />
              <button className="underline">Disconnect sign-in link</button>
            </form>
          </div>
        ))}
      </section>
      <section className="rounded-xl border border-border bg-paper p-5">
        <h2 className="text-xl font-semibold">
          Connect an existing approved account
        </h2>
        <p className="my-3 text-sm">
          Verify your program password once to connect it. Matching email
          addresses alone never grant access. Afterwards use Open dashboard
          without a separate sign-in.
        </p>
        <form action={connectProgramAction} className="grid max-w-lg gap-4">
          <label>
            Program
            <select name="program" className={input}>
              <option value="affiliate">Affiliates</option>
              <option value="partner">Partners</option>
            </select>
          </label>
          <label>
            Program email
            <input
              className={input}
              type="email"
              name="email"
              required
              autoComplete="username"
            />
          </label>
          <label>
            Current program password
            <input
              className={input}
              type="password"
              name="password"
              required
              maxLength={72}
              autoComplete="current-password"
            />
          </label>
          <button className="rounded-lg bg-primary p-3 text-on-primary">
            Connect program account
          </button>
        </form>
      </section>
      <section className="rounded-xl border border-border bg-paper p-5">
        <h2 className="text-xl font-semibold">Your partner relationships</h2>
        {!access.length && (
          <p className="mt-3">No partners have access to this business.</p>
        )}
        {access.map((a) => (
          <div key={String(a.id)} className="my-4 border-t border-border pt-4">
            <strong>{String(a.name)}</strong>
            <p className="my-2 text-sm">
              {a.revoked_at
                ? "Revoked"
                : (a.scopes as string[]).join(", ") ||
                  "Relationship only — no service permissions"}
            </p>
            {isOwner && !a.revoked_at && (
              <form action={revokePartnerAccessAction}>
                <input type="hidden" name="id" value={String(a.id)} />
                <button className="rounded-lg border border-border p-3">
                  Revoke access now
                </button>
              </form>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
