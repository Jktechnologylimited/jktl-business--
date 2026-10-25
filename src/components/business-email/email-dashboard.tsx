"use client";
import { useBusinessStore } from "@/lib/store";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  cancelEmailOrderAction,
  emailWorkspaceAction,
  orderBusinessEmailAction,
  resumeEmailOrderAction,
  verifyBusinessEmailPaymentAction,
  verifyEmailDomainAction,
  requestEmailHelpAction,
} from "@/lib/actions/business-email-actions";
import { EMAIL_TERMS } from "@/lib/business-email/model";
import { FeatureBadge } from "@/components/features/FeatureBadge";
import styles from "@/components/domains/domains.module.css";
type Row = Record<string, unknown>;
type Data = {
  plans: Row[];
  services: Row[];
  mailboxes: Row[];
  orders: Row[];
  requests: Row[];
  domains: Row[];
};
const money = (v: unknown) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
    Number(v) / 100,
  );
const date = (v: unknown) =>
  v
    ? new Date(String(v)).toLocaleDateString("en-NG", {
        timeZone: "Africa/Lagos",
      })
    : "Not scheduled";
export function EmailDashboard() {
  const mode = useBusinessStore((s) => s.mode);
  const [data, setData] = useState<Data | null>(null),
    [plan, setPlan] = useState<Row | null>(null),
    [renewal, setRenewal] = useState<Row | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const r = await emailWorkspaceAction();
    if (r.ok) setData(r.data);
    else setMessage(r.error);
  }
  useEffect(() => {
    if (mode !== "live") return;
    let active = true;
    emailWorkspaceAction().then(async (r) => {
      if (!active) return;
      if (r.ok) {
        setData(r.data);
        const p = new URLSearchParams(location.search);
        const selected = r.data.plans.find((v) => v.id === p.get("plan"));
        if (selected) setPlan(selected);
        if (p.get("reference")) {
          const checked = await verifyBusinessEmailPaymentAction(
            p.get("reference")!,
          );
          if (active) {
            setMessage(
              checked.ok
                ? "Payment verified. Review the order and setup status below."
                : checked.error,
            );
            if (checked.ok) {
              const latest = await emailWorkspaceAction();
              if (latest.ok) setData(latest.data);
            }
          }
        }
      } else setMessage(r.error);
    });
    return () => {
      active = false;
    };
  }, [mode]);
  async function run(
    fn: () => Promise<{ ok: boolean; error?: string; data?: { url: string } }>,
    redirect = false,
  ) {
    setBusy(true);
    try {
      const r = await fn();
      setMessage(
        r.ok ? "Updated." : r.error || "Could not complete this request.",
      );
      if (r.ok && redirect && r.data) location.assign(r.data.url);
      else if (r.ok) await load();
    } catch {
      setMessage(
        "Connection interrupted. Check the current order status before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (mode !== "live")
    return (
      <main className={styles.page}>
        <header className={styles.hero}>
          <p>JKTL BUSINESS EMAIL</p>
          <h1>
            Your business conversations.
            <br />
            Professionally managed.
          </h1>
          <p>
            Sign in to your live Business account to view email services, choose
            a plan and manage your mailboxes.
          </p>
          <div className={styles.links}>
            <Link href="/login?next=email">Sign in to Business Email</Link>
            <Link href="/business-email">Explore email plans</Link>
          </div>
        </header>
      </main>
    );
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <p>
          JKTL BUSINESS EMAIL <FeatureBadge slug="business-email" />
        </p>
        <h1>
          Professional email.
          <br />A stronger business identity.
        </h1>
        <p>
          Manage your mailboxes, domain setup, service agreements and support in
          one place.
        </p>
        <div className={styles.links}>
          <Link href="/business/domains">Domain registration & renewals</Link>
          <Link href="/email-terms">Email service terms</Link>
          <a href="/business-email">Explore Business Email</a>
        </div>
      </header>
      <div className={styles.body}>
        {message && (
          <p role="status" className={styles.notice}>
            {message}
          </p>
        )}
        {!data ? (
          <p>
            {message
              ? "Your email workspace is unavailable. Refresh or contact JKTL for assistance."
              : "Loading your email workspace…"}
          </p>
        ) : (
          <>
            <section className={styles.section}>
              <h2>Your email services</h2>
              {!data.services.length && (
                <p>
                  Choose a plan below, or ask JKTL to link an existing email
                  service. Existing mailboxes will not be migrated or billed
                  automatically.
                </p>
              )}
              <div className={styles.cards}>
                {data.services.map((s) => (
                  <article key={String(s.id)}>
                    <h3>{String(s.domain)}</h3>
                    <span className={styles.status}>
                      {String(s.status).replaceAll("_", " ")}
                    </span>
                    <dl>
                      <dt>Plan</dt>
                      <dd>{String(s.plan_name)}</dd>
                      <dt>Allowance</dt>
                      <dd>
                        {String(s.mailbox_limit)} mailboxes ·{" "}
                        {String(s.storage_gb)} GB per mailbox
                      </dd>
                      <dt>
                        {s.starts_at ||
                        s.status === "ACTIVE" ||
                        s.license_type === "LEGACY_FREE"
                          ? "Allocated addresses"
                          : "Requested addresses"}
                      </dt>
                      <dd>
                        {data.mailboxes
                          .filter(
                            (b) =>
                              b.service_id === s.id && b.status === "ALLOCATED",
                          )
                          .map((b) => String(b.address))
                          .join(", ") || "None allocated"}
                      </dd>
                      <dt>Available slots</dt>
                      <dd>
                        {Math.max(
                          0,
                          Number(s.mailbox_limit) -
                            data.mailboxes.filter(
                              (b) =>
                                b.service_id === s.id &&
                                b.status === "ALLOCATED",
                            ).length,
                        )}
                      </dd>
                      <dt>Started</dt>
                      <dd>{date(s.starts_at)}</dd>
                      <dt>Renewal</dt>
                      <dd>{date(s.renews_at)}</dd>
                      <dt>Billing</dt>
                      <dd>
                        {s.license_type === "LEGACY_FREE"
                          ? "Existing free provider service. No paid hosting subscription has been added."
                          : s.period_price_kobo
                            ? `${money(s.period_price_kobo)} / ${s.period_months} months`
                            : "Existing service arrangement"}
                      </dd>
                    </dl>
                    <p className={styles.note}>
                      {Number(s.management_fee_kobo) > 0 && (
                        <span className="block">
                          Recorded management fee proposal:{" "}
                          {money(s.management_fee_kobo)}. No separate charge has
                          been taken.
                        </span>
                      )}
                      Automatic charging is off. Any separately recorded
                      management fee requires its own agreement and payment
                      authorization.
                    </p>
                    {!s.verified_at && (
                      <div className={styles.notice}>
                        <p>Add this TXT record with your DNS provider:</p>
                        <code>_jktl-email.{String(s.domain)}</code>
                        <p>
                          <code>
                            jktl-email-verify={String(s.ownership_token)}
                          </code>
                        </p>
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(() => verifyEmailDomainAction(String(s.id)))
                          }
                        >
                          Verify domain ownership
                        </button>
                      </div>
                    )}
                    {Array.isArray(s.dns_records) &&
                      s.dns_records.length > 0 && (
                        <details>
                          <summary>DNS setup instructions</summary>
                          <p className={styles.note}>
                            Review existing records before making changes. JKTL
                            has not replaced any DNS records automatically.
                          </p>
                          {s.dns_records.map((r: Row, i: number) => (
                            <p key={i} style={{ overflowWrap: "anywhere" }}>
                              {["SPF", "DKIM", "DMARC"].includes(String(r.type))
                                ? `TXT (${r.type})`
                                : String(r.type)}{" "}
                              · {String(r.name)} · {String(r.value)}
                              {r.priority !== undefined
                                ? ` · priority ${r.priority}`
                                : ""}
                            </p>
                          ))}
                        </details>
                      )}
                    <div className={styles.actions}>
                      {s.status === "ACTIVE" && Boolean(s.webmail_url) && (
                        <a
                          href={String(s.webmail_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open webmail
                        </a>
                      )}
                      {Boolean(s.activation_url) && (
                        <a
                          href={String(s.activation_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Secure account setup
                        </a>
                      )}
                      {s.status === "ACTIVE" && s.license_type === "PAID" && (
                        <button
                          disabled={busy}
                          onClick={() => {
                            const p = data.plans.find(
                              (v) => v.id === s.plan_id,
                            );
                            if (p) {
                              setPlan(p);
                              setRenewal(s);
                              document
                                .getElementById("email-order")
                                ?.scrollIntoView({ block: "start" });
                            } else
                              setMessage(
                                "Request billing assistance to renew this service.",
                              );
                          }}
                        >
                          Review renewal
                        </button>
                      )}
                    </div>
                    <form
                      className={styles.form}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const d = new FormData(e.currentTarget);
                        run(() =>
                          requestEmailHelpAction(
                            String(s.id),
                            String(d.get("kind")),
                            String(d.get("message")),
                          ),
                        );
                      }}
                    >
                      <label>
                        Service request
                        <select name="kind">
                          {[
                            ["ADD_MAILBOX", "Additional mailbox"],
                            ["REMOVE_MAILBOX", "Remove a mailbox"],
                            ["ALIAS", "Mailbox alias"],
                            ["UPGRADE", "Plan upgrade"],
                            ["MIGRATION", "Email migration"],
                            ["PASSWORD_RESET", "Password reset assistance"],
                            ["BILLING", "Billing preferences or renewal"],
                            ["SUPPORT", "Technical assistance"],
                          ].map(([v, t]) => (
                            <option key={v} value={v}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        How can we help?
                        <textarea name="message" required maxLength={3000} />
                      </label>
                      <p className={styles.note}>
                        Do not include mailbox passwords or email contents.
                        Requests go to JKTL for review and setup.
                      </p>
                      <button disabled={busy}>Send request</button>
                    </form>
                  </article>
                ))}
              </div>
            </section>
            <section className={styles.section}>
              <h2>Choose your email plan</h2>
              <div className={styles.cards}>
                {data.plans.map((p) => (
                  <article key={String(p.id)}>
                    {Boolean(p.recommended) && (
                      <span className={styles.status}>MOST POPULAR</span>
                    )}
                    <h3>{String(p.name)}</h3>
                    <p>
                      {p.price_kobo
                        ? `${money(p.price_kobo)} / ${p.period_months} months`
                        : "Custom pricing"}
                    </p>
                    <p>
                      {String(p.mailbox_limit)}{" "}
                      {p.id === "custom" ? "or more " : ""}mailboxes ·{" "}
                      {String(p.storage_gb)} GB per mailbox
                    </p>
                    <ul>
                      {(p.features as string[]).map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setPlan(p);
                        setRenewal(null);
                      }}
                    >
                      {p.id === "team"
                        ? "Choose Team"
                        : p.id === "business"
                          ? "Choose Business"
                          : p.id === "custom"
                            ? "Contact Sales"
                            : "Get Started"}
                    </button>
                  </article>
                ))}
              </div>
            </section>
            <section id="email-order" className={styles.section}>
              <h2>{renewal ? "Review renewal" : "Build your email setup"}</h2>
              {!plan ? (
                <p>
                  Select a plan to review your domain and mailbox requirements.
                </p>
              ) : !plan.checkout_available ? (
                <>
                  <p>
                    {String(plan.name)} is available for setup enquiries.
                    Payments are not open for this plan yet.
                  </p>
                  <a
                    href={`https://jktl.com.ng/contact?product=business-email&plan=${plan.id}#form`}
                  >
                    Contact JKTL about {String(plan.name)}
                  </a>
                </>
              ) : (
                <form
                  className={styles.form}
                  key={String(plan.id) + String(renewal?.id || "new")}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const d = new FormData(e.currentTarget);
                    run(
                      () =>
                        orderBusinessEmailAction({
                          planId: String(plan.id),
                          planRevision: Number(plan.revision),
                          overrideRevision: Number(plan.override_revision),
                          domain: String(d.get("domain")),
                          mailboxes: String(d.get("mailboxes")),
                          consent: d.get("consent") === "on",
                          termsVersion: EMAIL_TERMS,
                          serviceId: renewal ? String(renewal.id) : undefined,
                        }),
                      true,
                    );
                  }}
                >
                  <p>
                    {String(plan.name)} · {money(plan.price_kobo)} for{" "}
                    {String(plan.period_months)} months ·{" "}
                    {String(plan.mailbox_limit)} mailbox allowance ·{" "}
                    {String(plan.storage_gb)} GB each
                  </p>
                  {Boolean(plan.pricing_note) && (
                    <p className={styles.notice}>
                      Agreed pricing and scope: {String(plan.pricing_note)}
                    </p>
                  )}
                  <label>
                    Your domain
                    <input
                      name="domain"
                      required
                      list="email-domains"
                      defaultValue={String(renewal?.domain || "")}
                      readOnly={Boolean(renewal)}
                      placeholder="yourbusiness.com"
                    />
                  </label>
                  <datalist id="email-domains">
                    {data.domains.map((d) => (
                      <option key={String(d.domain)} value={String(d.domain)} />
                    ))}
                  </datalist>
                  <p className={styles.note}>
                    Choose an account domain or enter one registered elsewhere.
                    You’ll verify ownership through DNS.{" "}
                    <Link href="/business/domains">Need a domain?</Link>
                  </p>
                  <label>
                    Preferred mailbox addresses (one per line)
                    <textarea
                      name="mailboxes"
                      required
                      placeholder={
                        "hello@yourbusiness.com\ninfo@yourbusiness.com"
                      }
                      defaultValue={
                        renewal
                          ? data.mailboxes
                              .filter(
                                (b) =>
                                  b.service_id === renewal.id &&
                                  b.status === "ALLOCATED",
                              )
                              .map((b) => b.address)
                              .join("\n")
                          : ""
                      }
                    />
                  </label>
                  <label className={styles.consent}>
                    <input type="checkbox" name="consent" required />I accept
                    the{" "}
                    <Link href="/email-terms" target="_blank">
                      email service terms
                    </Link>
                    , mailbox allowance and {money(plan.price_kobo)} payment for{" "}
                    {String(plan.period_months)} months. Renewal requires a new
                    payment; automatic charging is disabled.
                  </label>
                  <button disabled={busy}>
                    Pay {money(plan.price_kobo)} securely
                  </button>
                </form>
              )}
            </section>
            <section className={styles.section}>
              <h2>Billing history & orders</h2>
              {data.orders.map((o) => (
                <article key={String(o.id)} className={styles.request}>
                  <h3>
                    {String(o.domain)} · {String(o.plan_name)}
                  </h3>
                  <p>
                    {String(o.status).replaceAll("_", " ")} ·{" "}
                    {money(o.amount_kobo)} · {String(o.period_months)} months
                  </p>
                  <p className={styles.note}>
                    {Boolean(o.pricing_note) && (
                      <span className="block">
                        Agreed pricing and scope: {String(o.pricing_note)}
                      </span>
                    )}
                    Reference {String(o.reference)} ·{" "}
                    {o.paid_at
                      ? `Receipt verified ${date(o.paid_at)}`
                      : "Payment not verified"}
                  </p>
                  <div className={styles.actions}>
                    {o.status === "PENDING_PAYMENT" && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          run(() => resumeEmailOrderAction(String(o.id)), true)
                        }
                      >
                        Continue existing checkout
                      </button>
                    )}
                    {o.status === "PENDING_PAYMENT" && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          run(() => cancelEmailOrderAction(String(o.id)))
                        }
                      >
                        Cancel verified unpaid order
                      </button>
                    )}
                    <a href="https://jktl.com.ng/contact?product=business-email#form">
                      Contact email support
                    </a>
                    <button
                      disabled={busy}
                      onClick={() =>
                        run(() =>
                          verifyBusinessEmailPaymentAction(String(o.reference)),
                        )
                      }
                    >
                      Check payment status
                    </button>
                  </div>
                </article>
              ))}
            </section>
            <section className={styles.section}>
              <h2>Support history</h2>
              {data.requests.map((r) => (
                <article key={String(r.id)} className={styles.request}>
                  <span className={styles.status}>{String(r.status)}</span>
                  <p>
                    {String(r.kind)} · {String(r.message)}
                  </p>
                  {Boolean(r.reply) && <p>JKTL: {String(r.reply)}</p>}
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
