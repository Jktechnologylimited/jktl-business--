import Link from "next/link";
import { FeatureBadge } from "@/components/features/FeatureBadge";
import styles from "@/components/domains/domains.module.css";
type Row = Record<string, unknown>;
export function EmailLanding({
  plans,
  mainSite = false,
}: {
  plans: Row[];
  mainSite?: boolean;
}) {
  const portal = "https://business.jktl.com.ng";
  return (
    <div className={`${styles.page} ${styles.public}`}>
      <header className={styles.hero}>
        <p>
          JKTL BUSINESS EMAIL <FeatureBadge slug="business-email" />
        </p>
        <h1>
          Your Business Deserves a<br />
          Professional Email Address.
        </h1>
        <p>
          Build customer trust with branded email addresses that match your
          domain. Get professional business email through JKTL Business.
        </p>
        <div className={styles.links}>
          <a href={`${portal}/login?next=email`}>Get Business Email →</a>
          <a href="#email-pricing">View Pricing</a>
        </div>
      </header>
      <div className={styles.body}>
        <section className={styles.section}>
          <p className={styles.note}>
            PROFESSIONAL EMAIL FOR BUSINESSES THAT MEAN BUSINESS.
          </p>
          <h2>Your name, in every conversation.</h2>
          <p>
            Build credibility with professional email addresses that match your
            business domain. Create branded mailboxes, manage your email
            services, and keep your business communications professional.
          </p>
          <div className={styles.cards}>
            {[
              "hello@yourbusiness.com",
              "info@yourbusiness.com",
              "sales@yourbusiness.com",
              "support@yourbusiness.com",
            ].map((s) => (
              <article key={s}>
                <h3 style={{ fontSize: 16 }}>{s}</h3>
                <p>A dedicated address for your business conversations.</p>
              </article>
            ))}
          </div>
        </section>
        <section className={styles.section}>
          <h2>Made for the way you work.</h2>
          <div className={styles.cards}>
            {[
              [
                "A professional identity",
                "Keep your business name in the addresses customers see.",
              ],
              [
                "Room for your team",
                "Dedicated employee mailboxes and organized business communications.",
              ],
              [
                "Security essentials",
                "Configured spam filtering and standard email security, within your agreed service.",
              ],
              [
                "One service workspace",
                "View setup progress, renewal dates, billing and technical support in JKTL Business.",
              ],
            ].map(([title, desc]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{desc}</p>
              </article>
            ))}
          </div>
        </section>
        <section className={styles.section}>
          <h2>From your domain to your first conversation.</h2>
          <ol className="grid gap-5 md:grid-cols-3">
            {[
              "Choose your plan and preferred mailbox addresses.",
              "Connect a domain you own, or request one through JKTL.",
              "Verify ownership, complete setup and receive secure account access.",
            ].map((s, i) => (
              <li key={s}>
                <strong>0{i + 1}</strong>
                <p>{s}</p>
              </li>
            ))}
          </ol>
        </section>
        <section id="email-pricing" className={styles.section}>
          <h2>Business email pricing.</h2>
          <p>
            Prices are in NGN. Standard plans default to annual billing. Domain
            registration and additional services are separate. Checkout opens
            only when the plan is ready for purchase.
          </p>
          {!plans.length && (
            <p className={styles.notice}>
              The email catalogue is currently unavailable. Contact JKTL for a
              current quote.
            </p>
          )}
          <div className={styles.cards}>
            {plans.map((p) => (
              <article key={String(p.id)}>
                {Boolean(p.recommended) && (
                  <span className={styles.status}>MOST POPULAR</span>
                )}
                <h3>{String(p.name)}</h3>
                <p style={{ fontSize: 25 }}>
                  {p.price_kobo
                    ? `₦${(Number(p.price_kobo) / 100).toLocaleString("en-NG")}/${Number(p.period_months) === 12 ? "year" : `${p.period_months} months`}`
                    : "Custom Pricing"}
                </p>
                <p>
                  {String(p.mailbox_limit)}
                  {p.id === "custom" ? "+" : ""} professional{" "}
                  {Number(p.mailbox_limit) === 1 ? "mailbox" : "mailboxes"} ·{" "}
                  {p.id === "custom" && !p.price_kobo
                    ? "Storage assessed for your requirements"
                    : `${p.storage_gb} GB`}{" "}
                  {Number(p.mailbox_limit) > 1 ? "per mailbox" : ""}
                </p>
                <ul>
                  {(p.features as string[]).map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <a
                  className={styles.links}
                  href={
                    p.id === "custom"
                      ? "https://jktl.com.ng/contact?product=business-email#form"
                      : `${portal}/login?next=email&emailPlan=${encodeURIComponent(String(p.id))}`
                  }
                >
                  {p.id === "team"
                    ? "Choose Team"
                    : p.id === "business"
                      ? "Choose Business"
                      : p.id === "custom"
                        ? "Contact Sales"
                        : "Get Started"}{" "}
                  →
                </a>
                {!p.checkout_available && p.id !== "custom" && (
                  <p className={styles.note}>
                    Setup enquiries open. Payments are not open yet.
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
        {plans.length > 0 && (
          <section className={styles.section}>
            <h2>Compare your email plans.</h2>
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Included allowance</th>
                    {plans.map((p) => (
                      <th key={String(p.id)}>{String(p.name)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>Mailboxes</th>
                    {plans.map((p) => (
                      <td key={String(p.id)}>
                        {String(p.mailbox_limit)}
                        {p.id === "custom" && !p.price_kobo ? "+" : ""}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th>Storage per mailbox</th>
                    {plans.map((p) => (
                      <td key={String(p.id)}>
                        {p.id === "custom" && !p.price_kobo
                          ? "Assessed for your needs"
                          : `${p.storage_gb} GB`}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th>Billing period</th>
                    {plans.map((p) => (
                      <td key={String(p.id)}>
                        {p.price_kobo
                          ? `${p.period_months} months`
                          : "Tailored quote"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th>Purchase availability</th>
                    {plans.map((p) => (
                      <td key={String(p.id)}>
                        {p.checkout_available
                          ? "Ready for purchase"
                          : "Setup enquiries"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className={styles.note}>
              Plan features and any additional service scope are shown above and
              reviewed before payment.
            </p>
          </section>
        )}
        <section className={styles.section}>
          <h2>A clear plan for your domain.</h2>
          <p>
            Use a domain connected to JKTL or one registered elsewhere. Domain
            ownership verification and DNS setup are required. You remain in
            control of your DNS provider; existing records are reviewed before
            changes are requested.
          </p>
          <div className={styles.links}>
            <Link href={mainSite ? "/products/domains" : "/domains"}>
              Explore domains
            </Link>
            <a href={`${portal}/email-terms`}>
              Email service terms & provider disclosure
            </a>
          </div>
        </section>
        <section className={styles.section}>
          <h2>Your questions, answered.</h2>
          {[
            [
              "Is a domain included?",
              "Domain registration and renewal are separate from mailbox pricing. You can use a domain you already own.",
            ],
            [
              "Will my existing email be moved?",
              "Existing mailboxes are not migrated automatically. Ask JKTL to link your existing service or agree a migration plan.",
            ],
            [
              "Can I add mailboxes or aliases?",
              "Submit a service request in your email workspace. JKTL reviews the allowance, licensing and any additional charges before making changes.",
            ],
            [
              "Are renewals automatic?",
              "Automatic charging is disabled for this release. Review your renewal dates and pay an eligible renewal order when needed.",
            ],
            [
              "What happens after payment?",
              "JKTL verifies the payment, confirms ownership, configures your licensed service and provides secure activation instructions. Mailbox passwords are never stored in the portal.",
            ],
            [
              "Can I read email in JKTL Business?",
              "Your workspace manages the service and links to webmail. It does not store your messages or provide a separate inbox.",
            ],
          ].map(([q, a]) => (
            <details key={q} className={styles.request}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
        <section className={styles.hero}>
          <h2>Put your business name behind every email.</h2>
          <div className={styles.links}>
            <a href={`${portal}/login?next=email`}>Get Business Email →</a>
          </div>
        </section>
      </div>
    </div>
  );
}
