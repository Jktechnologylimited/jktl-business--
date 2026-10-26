import { requireAffiliateSession } from "@/lib/affiliate-session";
import { query } from "@/lib/custom/service";
import { requestPartnerServiceAction } from "@/lib/actions/partner-client-actions";
import { InviteClient } from "@/components/distribution/invite-client";
export const dynamic = "force-dynamic";
export default async function Clients() {
  const p = await requireAffiliateSession();
  // The parent layout and every mutation independently enforce approved Partner access.
  const clients = await query(
    `SELECT r.id,r.scopes,r.revoked_at,i.label, CASE WHEN r.revoked_at IS NULL AND 'VIEW_ALLOWED_SERVICES'=ANY(r.scopes) THEN jsonb_build_object('domains',(SELECT count(*) FROM domain_assets d WHERE d.organization_id=r.organization_id),'emailServices',(SELECT count(*) FROM email_services e WHERE e.organization_id=r.organization_id)) ELSE NULL END AS services FROM partner_client_access r JOIN partner_client_invitations i ON i.id=r.invitation_id JOIN affiliates a ON a.id=r.partner_id WHERE r.partner_id=$1 AND a.programme='partner' AND a.status='active' AND a.partner_terms_confirmed=true ORDER BY r.created_at DESC`,
    [p.id],
  );
  const invites = await query(
    "SELECT label,expires_at,accepted_at FROM partner_client_invitations WHERE partner_id=$1 ORDER BY created_at DESC LIMIT 50",
    [p.id],
  );
  const requests = await query(
    `SELECT q.id,q.product,q.status,q.reply FROM partner_service_requests q JOIN partner_client_access r ON r.id=q.relationship_id WHERE r.partner_id=$1 AND r.revoked_at IS NULL ORDER BY q.created_at DESC LIMIT 50`,
    [p.id],
  );
  return (
    <div className="space-y-7 text-ink">
      <h1 className="text-3xl font-semibold">Your clients</h1>
      <p>
        Invite owners to authorize a relationship. Clients keep ownership and
        can revoke your access. No passwords, private messages or payment
        credentials are shared.
      </p>
      <section className="rounded-xl border border-border p-5">
        <h2 className="mb-4 text-xl font-semibold">Invite a client</h2>
        <InviteClient />
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Authorized relationships</h2>
        {!clients.length && <p>No accepted relationships yet.</p>}
        {clients.map((c) => (
          <article
            key={String(c.id)}
            className="rounded-xl border border-border p-5"
          >
            <h3 className="font-semibold">{String(c.label)}</h3>
            <p className="my-3">
              {c.revoked_at
                ? "Client revoked access"
                : (c.scopes as string[]).join(", ") ||
                  "No service permissions granted"}
            </p>
            {Boolean(c.services) && (
              <p className="my-3 text-sm">
                Authorized service summary:{" "}
                {String((c.services as Record<string, unknown>).domains)}{" "}
                registered domains ·{" "}
                {String((c.services as Record<string, unknown>).emailServices)}{" "}
                email services. No mailbox content, credentials or billing data
                is shared.
              </p>
            )}
            {!c.revoked_at &&
              (c.scopes as string[]).includes("REQUEST_SERVICE_CHANGES") && (
                <form
                  action={requestPartnerServiceAction}
                  className="grid gap-3"
                >
                  <input
                    type="hidden"
                    name="relationship"
                    value={String(c.id)}
                  />
                  <label>
                    Service
                    <select
                      name="product"
                      className="ml-3 rounded border border-border bg-paper p-2"
                    >
                      {[
                        "website",
                        "domain",
                        "email",
                        "training",
                        "custom",
                        "managed-services",
                      ].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    What does the client need?
                    <textarea
                      name="message"
                      minLength={10}
                      maxLength={2000}
                      required
                      className="mt-2 block w-full rounded border border-border bg-paper p-3"
                    />
                  </label>
                  <p className="text-sm">
                    This submits a request for review. It does not place an
                    order, make a payment or change the client’s account.
                  </p>
                  <button className="rounded-lg bg-primary p-3 text-on-primary">
                    Request JKTL assistance
                  </button>
                </form>
              )}
          </article>
        ))}
      </section>
      <section>
        <h2 className="text-xl font-semibold">Invitation history</h2>
        {invites.map((i, n) => (
          <p key={n} className="my-2">
            {String(i.label)} ·{" "}
            {i.accepted_at
              ? "Accepted"
              : new Date(String(i.expires_at)) < new Date()
                ? "Expired"
                : "Waiting for owner"}
          </p>
        ))}
      </section>
      <section>
        <h2 className="text-xl font-semibold">Service requests</h2>
        {requests.map((r) => (
          <article
            key={String(r.id)}
            className="my-3 rounded border border-border p-4"
          >
            {String(r.product)} · {String(r.status)}
            <p>{String(r.reply)}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
