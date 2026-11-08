import Link from "next/link";
import { approvedPartner } from "@/lib/partners/access";
import { query } from "@/lib/custom/service";
export const dynamic = "force-dynamic";
export default async function Page() {
  const p = await approvedPartner();
  const quotes = await query(
    `SELECT q.id,q.amount_kobo,q.currency,q.billing_party,q.status,q.scope,q.expires_at,q.payment_reference,i.label,invoice.status invoice_status FROM partner_commercial_quotes q JOIN partner_service_requests r ON r.id=q.request_id JOIN partner_client_access a ON a.id=r.relationship_id JOIN partner_client_invitations i ON i.id=a.invitation_id LEFT JOIN custom_invoices invoice ON invoice.id=q.invoice_id WHERE a.partner_id=$1 AND a.revoked_at IS NULL ORDER BY q.created_at DESC LIMIT 50`,
    [p.id],
  );
  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
          Client services
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Services & payments</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-muted">
          Keep client purchases clear: review the service, confirm who pays, and
          use the existing secure checkout. A quote approval is separate from
          payment and fulfillment.
        </p>
      </header>
      <section className="grid gap-4 md:grid-cols-3">
        {[
          [
            "/partners/workspace",
            "Order a domain",
            "Choose a client → Services & payments → domain order. Current owner permission and product availability are checked before checkout.",
          ],
          [
            "/partners/clients",
            "Request email or other services",
            "Request the client’s required service and review the resulting quote. The billing party is agreed before payment.",
          ],
          [
            "/business/distribution",
            "Open secure billing",
            "Use your linked Business billing account to accept and pay quotes assigned to you. Customer-billed quotes are paid by the authorized client owner.",
          ],
        ].map(([href, title, text]) => (
          <Link
            key={href}
            href={href}
            className="rounded-2xl border border-border bg-paper p-5"
          >
            <h2 className="font-semibold">{title} →</h2>
            <p className="mt-3 text-sm leading-7 text-ink-muted">{text}</p>
          </Link>
        ))}
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Client service quotes</h2>
        {!quotes.length && (
          <div className="rounded-2xl border border-border bg-paper p-6">
            <p className="font-semibold">No service quotes yet.</p>
            <p className="mt-3 text-sm leading-7 text-ink-muted">
              Prepare the client website, obtain owner approval and request the
              required services. Creating a draft does not charge you or the
              client.
            </p>
            <Link
              href="/partners/workspace"
              className="mt-4 inline-block text-sm font-semibold text-blue-600 underline"
            >
              Open client workspace →
            </Link>
          </div>
        )}
        {quotes.map((q) => {
          const paid = q.invoice_status === "PAID";
          const expired =
              q.status === "OFFERED" &&
              new Date(String(q.expires_at)) < new Date(),
            partner = q.billing_party === "PARTNER";
          return (
            <article
              key={String(q.id)}
              className="rounded-2xl border border-border bg-paper p-6"
            >
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <p className="text-xs text-ink-muted">{String(q.label)}</p>
                  <h3 className="mt-2 text-xl font-semibold">
                    {new Intl.NumberFormat("en-NG", {
                      style: "currency",
                      currency: String(q.currency || "NGN"),
                    }).format(Number(q.amount_kobo) / 100)}
                  </h3>
                </div>
                <span className="self-start rounded-full bg-surface px-3 py-2 text-xs font-semibold">
                  {paid && q.status !== "FULFILLED"
                    ? "Paid · setup pending"
                    : expired
                      ? "Expired"
                      : String(q.status).toLowerCase().replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7">
                {String(q.scope)}
              </p>
              <p className="mt-4 text-sm font-semibold">
                {partner
                  ? "Billing party: your partner business"
                  : "Billing party: client business"}
              </p>
              <p className="mt-2 text-xs leading-6 text-ink-muted">
                {partner
                  ? "Open the Business account linked to this Partner profile. The billing account owner must approve the exact quote before paying."
                  : "The authorized client owner reviews and pays from their own Business account. Your Partner login cannot approve payment on their behalf."}
              </p>
              {!expired &&
                !paid &&
                ["OFFERED", "ACCEPTED"].includes(String(q.status)) &&
                partner && (
                  <Link
                    href={"/business/distribution#quote-" + q.id}
                    className="mt-5 inline-block rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary"
                  >
                    {q.status === "ACCEPTED"
                      ? "Open secure payment"
                      : "Review & approve billing"}
                  </Link>
                )}
              {expired && (
                <Link
                  href="/partners/support"
                  className="mt-4 inline-block text-sm text-blue-600 underline"
                >
                  Ask for a refreshed quote
                </Link>
              )}
            </article>
          );
        })}
      </section>
      <aside className="rounded-2xl border border-border bg-surface p-5 text-sm leading-7">
        A bank alert or completed checkout does not confirm provisioning. If
        charged without a confirmed status, keep the reference and ask support
        before paying again.{" "}
        <Link href="/help/payment-recovery" className="text-blue-600 underline">
          Payment troubleshooting →
        </Link>
      </aside>
    </div>
  );
}
