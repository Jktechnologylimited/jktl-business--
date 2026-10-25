import Link from "next/link";
export const metadata = { title: "Business Email service terms | JKTL" };
export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 leading-relaxed text-ink">
      <Link href="/business-email">← JKTL Business Email</Link>
      <h1 className="my-8 text-4xl font-semibold">
        Business Email service terms
      </h1>
      <p>Version email-service-2026-01 · JK TECHNOLOGY LIMITED</p>
      {[
        [
          "Your service",
          "Your accepted order states the domain, mailbox allowance, storage allowance, service features, price and billing period. Domain registration, extra mailboxes, migration and management fees require separate disclosed agreements. No automatic card charge is authorized by creating an account or placing an order.",
        ],
        [
          "Infrastructure and licensing",
          "Zoho Mail provides underlying email infrastructure. JKTL supplies setup, service administration and support within the agreed scope. Paid packages require properly licensed paid services and confirmed resale/provisioning rights. JKTL does not claim to operate independent email servers. Provider terms and data-processing policies apply to infrastructure use; contact JKTL for the applicable documentation before ordering.",
        ],
        [
          "Domain and DNS",
          "You must own the domain or be authorized to configure it. TXT ownership verification and appropriate MX, SPF, DKIM and DMARC configuration are required. Existing DNS is not replaced automatically. Changes can affect an existing email service; agree a migration plan before changing records.",
        ],
        [
          "Provisioning and access",
          "Payment is verified server-side before a setup request is accepted. Active status requires completed provisioning and sending/receiving checks. We use secure provider-supported activation or password setup; never send passwords or email contents through portal support. The portal stores service and mailbox metadata, not mailbox passwords or email contents.",
        ],
        [
          "Renewals and changes",
          "Eligible paid services may be renewed at a newly reviewed price. Existing agreed periods retain their price. Automatic charging is off. Overdue JKTL invoices do not automatically suspend or delete mailboxes. Any suspension or cancellation follows the service agreement and administrator workflow.",
        ],
        [
          "Existing services",
          "Linking a pre-existing free or paid provider service is an administrative record only. It does not migrate mailboxes, create a paid hosting subscription or authorize charges. Recorded management fees require separate explicit acceptance and payment authorization.",
        ],
        [
          "Failures, refunds and support",
          "Contact JKTL for failed setup, billing corrections or refund review. This email service is separate from the website plan guarantee. Do not assume that payment alone means DNS or provisioning is complete. No unsupported uptime, deliverability or security-certification guarantee is made.",
        ],
      ].map(([h, p]) => (
        <section key={h} className="my-8">
          <h2 className="mb-3 text-xl font-semibold">{h}</h2>
          <p>{p}</p>
        </section>
      ))}
    </main>
  );
}
