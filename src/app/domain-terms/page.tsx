import Link from "next/link";
export const metadata = { title: "Domain registration terms | JKTL Business" };
export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-ink">
      <Link href="/domains" className="text-primary underline">
        ← Domains
      </Link>
      <h1 className="mt-7 text-4xl font-semibold">Domain registration terms</h1>
      <p className="mt-3 text-xs text-ink-muted">
        Version domain-order-2026-01
      </p>
      {[
        [
          "Your domain, your registrant details",
          "The customer or the person they are authorized to represent is recorded as the legitimate registrant. You must provide accurate contact and address details and satisfy the registry’s eligibility rules. JKTL does not substitute itself as the owner.",
        ],
        [
          "Availability and payment",
          "Search results are time-limited checks, not reservations or guarantees. Premium and restricted names need a confirmed quote. The final registration or renewal total, period and current future renewal price are shown before your one-off NGN payment. No domain is bought automatically after payment.",
        ],
        [
          "Registration and fulfillment",
          "Verified payments enter a JKTL fulfillment queue. Registration, renewal, nameserver changes, DNS changes and transfers are completed by JKTL. A domain becomes active, or its expiry changes, only after registrar confirmation is recorded.",
        ],
        [
          "If registration fails",
          "If a paid order cannot be fulfilled, JKTL records the failure and provides a full-refund process. A request or pending refund is not a completed refund; the payment provider must confirm it. Partial provider refunds remain pending until the full amount is returned. Once registration succeeds, cancellation/refund rights depend on the applicable registrar and registry rules. Domain purchases are separate from the website-plan 14-day guarantee.",
        ],
        [
          "Renewal",
          "Renewals require a new order and explicit payment approval. JKTL does not auto-charge a saved card for domain renewals. Reminder delivery depends on accurate account email and the notification service; you remain responsible for renewing before the registry deadline. Expired domains require an eligibility review.",
        ],
        [
          "Website connection and transfer",
          "A domain can be purchased without a website or paid website plan. Connecting it to a JKTL website follows the existing custom-domain plan requirements and requires ownership, DNS and hosting verification. Transfer assistance is available subject to registrar/registry locks and rules. Request it in My Domains; never send passwords or transfer codes in support notes.",
        ],
        [
          "Privacy and support",
          "Registrant contact details are encrypted for fulfillment and disclosed only to the authorized operational team and registration provider as necessary. Transactional notices do not include your full registrant details. Visit My Domains for requests, payment verification and support.",
        ],
      ].map(([title, body]) => (
        <section className="mt-9" key={title}>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-3 text-sm leading-8 text-ink-muted">{body}</p>
        </section>
      ))}
      <p className="mt-10 text-sm">
        <Link href="https://jktl.com.ng/privacy" className="underline">
          Privacy policy
        </Link>{" "}
        ·{" "}
        <Link href="https://jktl.com.ng/terms" className="underline">
          General terms
        </Link>
      </p>
    </main>
  );
}
