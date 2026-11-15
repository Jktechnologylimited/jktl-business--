import Link from "next/link";
import { owner, query } from "@/lib/custom/service";
import { renewalInstalled, renewalRegister } from "@/lib/renewals/service";
import { renewalKinds, renewalDay } from "@/lib/renewals/model";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your renewals | JKTL Business",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const session = await owner();
  const items = (await renewalInstalled())
    ? await query(
        `SELECT * FROM ${await renewalRegister()} WHERE organization_id=$1 ORDER BY due_on NULLS LAST`,
        [session.organizationId],
      )
    : [];
  return (
    <main className="mx-auto max-w-4xl space-y-5 p-6 text-ink">
      <h1 className="text-3xl font-semibold">Your renewals</h1>
      <p className="text-ink-muted">
        Review upcoming renewals for your JKTL services. Prices and payment
        status are confirmed in the service workspace before payment.
      </p>
      {!items.length && (
        <p>No paid renewals are currently recorded for this account.</p>
      )}
      {items.map((item) => (
        <article
          className="rounded-xl border border-border bg-paper p-5"
          key={String(item.item_key)}
        >
          <p className="text-xs uppercase tracking-wide">
            {renewalKinds[String(item.kind)]}
          </p>
          <h2 className="my-2 text-xl font-semibold">{String(item.name)}</h2>
          <p>
            {item.due_on
              ? "Renewal date: " + renewalDay(item.due_on)
              : "Renewal date needs confirmation"}
          </p>
          <p className="mt-3 whitespace-pre-line text-sm">{String(item.service_scope || item.name)}</p>
          {item.amount_kobo != null && <p className="mt-2 font-semibold">{new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN"}).format(Number(item.amount_kobo)/100)}{item.billing_interval === "ANNUAL" ? " / year" : item.billing_interval === "MONTHLY" ? " / month" : ""}</p>}
          {Number(item.days_left) < 0 && (
            <p className="mt-2 text-danger">
              This renewal date has passed. Review the service status or contact
              JKTL.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link className="text-blue-600 underline" href={String(item.path)}>
              Review service
            </Link>
            <a
              className="text-blue-600 underline"
              href={
                "mailto:info@jktl.com.ng?subject=" +
                encodeURIComponent("Renewal help: " + String(item.name))
              }
            >
              Ask JKTL for help
            </a>
          </div>
        </article>
      ))}
    </main>
  );
}
