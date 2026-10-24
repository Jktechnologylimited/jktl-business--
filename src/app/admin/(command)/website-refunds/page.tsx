import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import { getSql } from "@/lib/db/client";
import { priceNGN } from "@/lib/website-pricing";
export const dynamic = "force-dynamic";
export default async function Refunds() {
  const admin = await requireAdminSession();
  if (admin.role !== "owner") redirect("/admin/insights");
  const sql = getSql();
  const rows =
    await sql`SELECT r.*,p.amount_kobo,p.paid_at,p.provider_transaction_id,b.display_name,s.subscription_code,s.cancel_at_period_end FROM website_plan_refund_requests r JOIN website_plan_payments p ON p.reference=r.payment_reference JOIN business_profiles b ON b.organization_id=r.organization_id LEFT JOIN website_plan_subscriptions s ON s.organization_id=r.organization_id ORDER BY r.requested_at DESC LIMIT 200`;
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="font-display text-3xl">Website guarantee refunds</h1>
      <p className="mt-4 text-sm">
        Eligible requests are recorded inside the first 14 days. Process the
        full first website-plan payment using its transaction reference in the
        Paystack dashboard. Stop the website subscription renewal before
        refunding. The signed refund.processed webhook updates the customer’s
        status and removes paid access after the provider processes the refund.
        Never refund domain, email or AI transactions from this queue.
      </p>
      <a
        href="https://dashboard.paystack.com/#/transactions"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-block text-sm underline"
      >
        Open Paystack transactions
      </a>
      {rows.length === 0 ? (
        <p className="mt-8">No refund requests.</p>
      ) : (
        <div className="mt-8 grid gap-4">
          {rows.map((row) => (
            <article
              key={String(row.organization_id)}
              className="rounded-xl border border-border p-5"
            >
              <h2 className="font-semibold">
                {String(row.display_name)} · {priceNGN(Number(row.amount_kobo))}
              </h2>
              <p className="mt-2 text-sm">
                Status: {String(row.status)} · Requested{" "}
                {new Date(String(row.requested_at)).toLocaleString("en-NG")}
              </p>
              <p className="mt-2 break-all font-mono text-xs">
                Transaction: {String(row.provider_transaction_id)} · Reference:{" "}
                {String(row.payment_reference)}
              </p>
              <p className="mt-3 text-sm">{String(row.reason)}</p>
              <p className="mt-2 text-sm">
                Subscription{" "}
                {String(
                  row.subscription_code || "still awaiting provider attachment",
                )}{" "}
                · Renewal{" "}
                {row.cancel_at_period_end
                  ? "off"
                  : "must be stopped before refund"}
              </p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
