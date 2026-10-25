"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Globe,
  FileText,
  LifeBuoy,
  ExternalLink,
  Layers,
  ShieldCheck,
} from "lucide-react";
import {
  customWorkspaceAction,
  acceptCustomServiceAction,
  payCustomInvoiceAction,
  verifyCustomPaymentAction,
  createCustomRequestAction,
  openCustomCmsAction,
} from "@/lib/actions/custom-project-actions";
import styles from "@/components/domains/domains.module.css";
type Row = Record<string, unknown>;
type Data = {
  projects: Row[];
  services: Row[];
  invoices: Row[];
  requests: Row[];
  client: Row | null;
};
const money = (n: unknown) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(Number(n) / 100);
const day = (d: unknown) =>
  d
    ? new Date(String(d)).toLocaleDateString("en-NG", {
        timeZone: "Africa/Lagos",
      })
    : "—";
export function CustomWorkspace() {
  const [data, setData] = useState<Data | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const r = await customWorkspaceAction();
    if (r.ok) setData(r.data);
    else setMessage(r.error);
  }
  useEffect(() => {
    let active = true;
    customWorkspaceAction().then((r) => {
      if (active) {
        if (r.ok) setData(r.data);
        else setMessage(r.error);
      }
    });
    return () => {
      active = false;
    };
  }, []);
  async function run(
    task: () => Promise<{
      ok: boolean;
      error?: string;
      data?: { url: string };
    }>,
    redirect = false,
  ) {
    setBusy(true);
    setMessage("");
    try {
      const r = await task();
      if (!r.ok) setMessage(r.error || "Please retry.");
      else if (redirect && r.data) window.location.assign(r.data.url);
      else {
        setMessage("Updated.");
        await load();
      }
    } catch {
      setMessage(
        "Connection interrupted. Check status before retrying a payment.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <p>JKTL BUSINESS / CUSTOM CLIENT</p>
        <h1>
          Your business.
          <br />
          Your workspace.
        </h1>
        <p>
          Your professionally built websites, service agreements and support,
          together in one place.
        </p>
        <div className={styles.links}>
          <Link href="/business/domains">Domain renewals</Link>
          <Link href="/business/billing">Subscriptions</Link>
          <a href="https://jktl.com.ng/products">Explore JKTL products</a>
        </div>
      </header>
      <div className={styles.body}>
        {message && (
          <p role="status" className={styles.notice}>
            {message}
          </p>
        )}
        {!data ? (
          <p>Loading your workspace…</p>
        ) : (
          <>
            <section className={styles.section}>
              <h2>
                <Globe className="inline size-5" /> My Websites
              </h2>
              {data.projects.length === 0 ? (
                <p>
                  Your custom projects will appear here once JKTL has configured
                  your workspace. Your existing website continues to work.
                </p>
              ) : (
                <div className={styles.cards}>
                  {data.projects.map((p) => (
                    <article className={styles.section} key={String(p.id)}>
                      <span className={styles.status}>{String(p.status)}</span>
                      <h3>{String(p.name)}</h3>
                      <p>{String(p.description)}</p>
                      <p className="my-4 break-all">
                        <a
                          href={String(p.website_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {new URL(String(p.website_url)).hostname}{" "}
                          <ExternalLink className="inline size-3" />
                        </a>
                      </p>
                      <div className={styles.links}>
                        <button
                          disabled={
                            busy || !p.cms_tested_at || p.status !== "LIVE"
                          }
                          onClick={() =>
                            run(() => openCustomCmsAction(String(p.id)), true)
                          }
                        >
                          Edit website
                        </button>
                        {Boolean(p.analytics_url) && (
                          <a
                            href={String(p.analytics_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Analytics
                          </a>
                        )}
                        <Link href="/business/domains">Domain & DNS</Link>
                        <a href="#custom-support">Business email & support</a>
                      </div>
                      {!p.cms_tested_at && (
                        <p className="mt-3 text-xs">
                          CMS access is being configured. Request content
                          updates through Support.
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
            <section className={styles.section}>
              <h2>
                <Layers className="inline size-5" /> Services & agreements
              </h2>
              <p>
                Hosting, maintenance and third-party costs are itemized
                separately. Review each proposal before accepting. Payments are
                made by you; automatic charging is disabled.
              </p>
              {data.services.length === 0 && (
                <p className="mt-4">No services have been proposed yet.</p>
              )}
              {data.services.map((s) => (
                <article
                  key={String(s.id)}
                  className="mt-6 rounded-xl border border-border p-5"
                >
                  <span className={styles.status}>{String(s.status)}</span>
                  <h3>{String(s.name)}</h3>
                  <p>{String(s.description)}</p>
                  <p className="my-3 font-semibold">
                    {money(Number(s.amount_kobo) - Number(s.discount_kobo))} /{" "}
                    {String(s.interval).toLowerCase()} · starts{" "}
                    {day(s.starts_on)}
                  </p>
                  {Number(s.discount_kobo) > 0 && (
                    <p>Discount: {money(s.discount_kobo)} per invoice</p>
                  )}
                  {s.status === "PROPOSED" && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        run(() =>
                          acceptCustomServiceAction(
                            String(s.id),
                            Number(s.revision),
                            true,
                          ),
                        );
                      }}
                    >
                      <label className={styles.consent}>
                        <input type="checkbox" required /> I accept the amount,
                        billing interval and service scope above. I understand
                        that invoices require payment and automatic charging is
                        disabled.
                      </label>
                      <button disabled={busy}>Accept agreement</button>
                    </form>
                  )}
                  {Boolean(s.accepted_at) && (
                    <p className="text-xs">
                      Accepted {day(s.accepted_at)} · next billing date{" "}
                      {day(s.next_due_on)}
                    </p>
                  )}
                </article>
              ))}
            </section>
            <section className={styles.section}>
              <h2>
                <FileText className="inline size-5" /> Invoices & receipts
              </h2>
              <button
                disabled={busy}
                onClick={() => {
                  const reference = new URLSearchParams(location.search).get(
                    "reference",
                  );
                  if (reference)
                    run(() => verifyCustomPaymentAction(reference));
                  else load();
                }}
              >
                Refresh payment status
              </button>
              {data.invoices.length === 0 ? (
                <p className="mt-4">No invoices yet.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>Service</th>
                        <th>Due</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.invoices.map((i) => (
                        <tr key={String(i.id)}>
                          <td>{String(i.description)}</td>
                          <td>{day(i.due_on)}</td>
                          <td>{money(i.amount_kobo)}</td>
                          <td>
                            {String(i.status)}
                            {i.status === "PAID" && (
                              <small className="block">
                                Receipt {String(i.reference)} · {day(i.paid_at)}
                              </small>
                            )}
                          </td>
                          <td>
                            {i.status === "OPEN" && (
                              <>
                                <button
                                  disabled={busy}
                                  onClick={() =>
                                    run(
                                      () =>
                                        payCustomInvoiceAction(String(i.id)),
                                      true,
                                    )
                                  }
                                >
                                  Pay invoice
                                </button>
                                {Boolean(i.reference) && (
                                  <button
                                    disabled={busy}
                                    onClick={() =>
                                      run(() =>
                                        verifyCustomPaymentAction(
                                          String(i.reference),
                                        ),
                                      )
                                    }
                                  >
                                    Check payment
                                  </button>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section id="custom-support" className={styles.section}>
              <h2>
                <LifeBuoy className="inline size-5" /> Support & change requests
              </h2>
              {data.projects.length > 0 && (
                <form
                  className={styles.form}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = e.currentTarget,
                      d = new FormData(f);
                    run(() =>
                      createCustomRequestAction(
                        String(d.get("project")),
                        String(d.get("kind")),
                        String(d.get("message")),
                      ),
                    );
                  }}
                >
                  <label>
                    Website
                    <select name="project" required>
                      {data.projects.map((p) => (
                        <option key={String(p.id)} value={String(p.id)}>
                          {String(p.name)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Request type
                    <select name="kind">
                      <option value="CONTENT">Content update</option>
                      <option value="FIX">Fix a problem</option>
                      <option value="DEVELOPMENT">
                        Additional development
                      </option>
                      <option value="EMAIL">Business email</option>
                      <option value="SUPPORT">Technical support</option>
                    </select>
                  </label>
                  <label>
                    How can we help?
                    <textarea name="message" required maxLength={4000} />
                  </label>
                  <p className="text-xs">
                    Please keep passwords, payment card details and private
                    customer data out of requests. Additional development may
                    need a separate quote.
                  </p>
                  <button disabled={busy}>Send request</button>
                </form>
              )}
              {data.requests.map((r) => (
                <article
                  key={String(r.id)}
                  className="my-4 border-t border-border pt-4"
                >
                  <span className={styles.status}>{String(r.status)}</span>
                  <p className="whitespace-pre-wrap">{String(r.message)}</p>
                  {Boolean(r.reply) && (
                    <p className="mt-3 whitespace-pre-wrap">
                      JKTL: {String(r.reply)}
                    </p>
                  )}
                </article>
              ))}
            </section>
            <p className="flex gap-2 text-xs text-ink-muted">
              <ShieldCheck className="size-4" /> Your custom websites keep their
              independent applications and data. This workspace manages your
              access and JKTL services.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
