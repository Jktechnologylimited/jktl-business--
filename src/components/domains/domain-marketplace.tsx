"use client";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useBusinessStore } from "@/lib/store";
import {
  searchDomainsAction,
  customerDomainsAction,
  createDomainOrderAction,
  resumeDomainOrderAction,
  verifyDomainPaymentAction,
  cancelDomainOrderAction,
  requestDomainTaskAction,
  requestDomainConnectionAction,
  verifyPurchasedDomainConnectionAction,
  requestDomainRefundAction,
  requestOrderSupportAction,
} from "@/lib/actions/domain-order-actions";
import {
  DOMAIN_TERMS,
  money,
  domainProgress,
  type Registrant,
} from "@/lib/domains/model";
import styles from "./domains.module.css";
type Row = Record<string, unknown>;
export type DomainData = {
  prices: Row[];
  orders: Row[];
  assets: Row[];
  checks: Row[];
  tasks: Row[];
  purchasesEnabled?: boolean;
};
const blank = (): DomainData => ({
  prices: [],
  orders: [],
  assets: [],
  checks: [],
  tasks: [],
});
const text = (r: Row, key: string) => String(r[key] ?? "");
const date = (v: unknown) =>
  v
    ? new Date(String(v)).toLocaleDateString("en-NG", {
        timeZone: "Africa/Lagos",
      })
    : "—";
const contactFields: [keyof Registrant, string][] = [
  ["name", "Registrant full name"],
  ["email", "Registrant email"],
  ["phone", "Registrant phone"],
  ["company", "Company (optional)"],
  ["address", "Street address"],
  ["city", "City"],
  ["state", "State / province"],
  ["postalCode", "Postal code"],
  ["country", "Country code (e.g. NG)"],
];
export function DomainMarketplace({
  initialPrices = [],
  publicPage = false,
  unavailable = false,
}: {
  initialPrices?: Row[];
  publicPage?: boolean;
  unavailable?: boolean;
}) {
  const authenticated = useBusinessStore((s) => s.authenticated);
  const mode = useBusinessStore((s) => s.mode);
  const [data, setData] = useState<DomainData>(() => ({
    ...blank(),
    prices: initialPrices,
  }));
  const [domain, setDomain] = useState("");
  const [extension, setExtension] = useState(
    String(initialPrices[0]?.extension || ".com.ng"),
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<{
    domain: string;
    extension: string;
    kind: "REGISTER" | "RENEW";
    assetId?: string;
    price: Row;
  } | null>(null);
  const [years, setYears] = useState(1);
  const [consent, setConsent] = useState(false);
  const [contact, setContact] = useState<Registrant>({
    name: "",
    email: "",
    phone: "",
    company: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    country: "NG",
  });
  const [taskAsset, setTaskAsset] = useState("");
  const [taskOrder, setTaskOrder] = useState("");
  const [taskKind, setTaskKind] = useState("SUPPORT");
  const [taskText, setTaskText] = useState("");
  const [dns, setDns] = useState<Record<string, string> | null>(null);
  const load = useCallback(async () => {
    if (!authenticated || mode !== "live") return;
    const result = await customerDomainsAction();
    if (result.ok) {
      setData(result.data);
      const requested =
        new URLSearchParams(window.location.search).get("domain") || "";
      const chosen = result.data.prices
        .slice()
        .sort((a, b) => String(b.extension).length - String(a.extension).length)
        .find((p) => requested.endsWith(String(p.extension)));
      if (requested && chosen) {
        setDomain(requested);
        setExtension(String(chosen.extension));
      }
      setExtension((current) =>
        result.data.prices.some((p) => p.extension === current)
          ? current
          : String(result.data.prices[0]?.extension || current),
      );
    } else setMessage(result.error);
  }, [authenticated, mode]);
  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);
  useEffect(() => {
    if (!authenticated || mode !== "live") return;
    const reference = new URLSearchParams(window.location.search).get(
      "reference",
    );
    if (!reference) return;
    let active = true;
    verifyDomainPaymentAction(reference).then((result) => {
      if (active) {
        setMessage(
          result.ok
            ? result.data.paid
              ? "Payment verified. Your domain setup is in progress."
              : `Payment is ${result.data.status}; the order remains unpaid.`
            : result.error,
        );
        void load();
      }
    });
    return () => {
      active = false;
    };
  }, [authenticated, mode, load]);
  async function run(
    fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>,
    success: string,
  ): Promise<{ ok: boolean; error?: string; data?: unknown }> {
    setBusy(true);
    setMessage("");
    try {
      const r = await fn();
      setMessage(r.ok ? success : r.error || "Could not complete the request.");
      if (r.ok) await load();
      return r;
    } catch {
      setMessage("Could not complete the request. Please retry.");
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }
  function choose(check: Row) {
    const price = data.prices.find((p) => p.extension === check.extension);
    if (!price) return;
    setSelected({
      domain: text(check, "domain"),
      extension: text(check, "extension"),
      kind: "REGISTER",
      price,
    });
    setYears(1);
    setConsent(false);
  }
  useEffect(() => {
    if (!selected) return;
    const id = requestAnimationFrame(() =>
      document.getElementById("domain-checkout")?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      }),
    );
    return () => cancelAnimationFrame(id);
  }, [selected]);
  const unit = selected
    ? Number(
        selected.kind === "REGISTER"
          ? selected.price.registration_price
          : selected.price.renewal_price,
      )
    : 0;
  return (
    <div className={`${styles.page} ${publicPage ? styles.public : ""}`}>
      <header className={styles.hero}>
        <p>JKTL DOMAINS</p>
        <h1>
          Your name.
          <br />
          Your next chapter.
        </h1>
        <p>
          Buy a domain on its own or connect it to your JKTL website. One order,
          one payment. JKTL handles your registration and renewal setup.
        </p>
        <div className={styles.links}>
          <Link href="/business/domains">My Domains</Link>
          <Link href="/business/website">My website</Link>
          <Link href="/domain-terms">Domain terms</Link>
        </div>
      </header>
      <div className={styles.body}>
        {(!authenticated || mode !== "live") && (
          <aside className={styles.notice}>
            Browse prices below.{" "}
            <Link href="/login?next=domains">
              Sign in as the business owner
            </Link>{" "}
            to purchase and manage domains. You can search without an account.
            Demo accounts cannot make purchases.
          </aside>
        )}
        {authenticated &&
          mode === "live" &&
          data.purchasesEnabled === false && (
            <p className={styles.notice}>
              Domain checkout is temporarily unavailable. You can search, view
              your existing domains and contact support.
            </p>
          )}
        {unavailable && (
          <p className={styles.notice}>
            The domain catalogue is being prepared. Please check back shortly or
            contact JKTL for help.
          </p>
        )}
        <section className={styles.section}>
          <h2>Find your domain</h2>
          <form
            className={styles.search}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!authenticated || mode !== "live") {
                await run(async () => {
                  const response = await fetch("/api/public/domain-search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: domain, extension }),
                  });
                  const result = await response.json();
                  if (!response.ok)
                    return {
                      ok: false,
                      error:
                        result.error || "Availability could not be confirmed.",
                    };
                  setData((current) => ({
                    ...current,
                    checks: result.results.map((r: Row) => ({
                      id: r.domain,
                      domain: r.domain,
                      extension: r.extension,
                      status: r.status,
                      checked_at: new Date().toISOString(),
                      valid_until: new Date(Date.now() + 60000).toISOString(),
                    })),
                  }));
                  return { ok: true };
                }, "Search updated. Availability is checked again before payment.");
                return;
              }
              await run(
                () => searchDomainsAction(domain, extension),
                "Search updated. Availability checks do not reserve a domain.",
              );
            }}
          >
            <label>
              Domain name
              <input
                required
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="yourbusiness"
                maxLength={253}
              />
            </label>
            <label>
              Extension
              <select
                value={extension}
                onChange={(e) => setExtension(e.target.value)}
              >
                {data.prices.map((p) => (
                  <option key={text(p, "extension")}>
                    {text(p, "extension")}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={busy || !data.prices.length}>
              Check availability
            </button>
          </form>
          <p className={styles.note}>
            Availability can change before registration. Premium or restricted
            names may require a confirmed quote.
          </p>
          <button
            className={styles.secondary}
            disabled={busy || !authenticated || mode !== "live"}
            onClick={() =>
              void run(async () => {
                await load();
                return { ok: true };
              }, "Availability and orders refreshed.")
            }
          >
            Refresh my requests
          </button>
          <div className={styles.checks}>
            {data.checks.map((c) => (
              <article key={text(c, "id")}>
                <div>
                  <strong>{text(c, "domain")}</strong>
                  <span className={styles.status}>
                    {c.availability_status === "APPEARS_AVAILABLE"
                      ? "Appears available — eligibility and pricing still need confirmation"
                      : text(c, "status") === "UNKNOWN"
                        ? "Availability not confirmed"
                        : text(c, "status")}
                  </span>
                </div>
                <p className={styles.note}>
                  {c.checked_at
                    ? `Checked ${new Date(String(c.checked_at)).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}. Availability can change before registration.`
                    : "We could not confirm availability. Try again shortly."}
                </p>
                {c.status === "AVAILABLE" &&
                  new Date(text(c, "valid_until")).getTime() > now &&
                  (!authenticated || mode !== "live" ? (
                    <Link
                      href={`/login?next=domains&domain=${encodeURIComponent(String(c.domain))}`}
                    >
                      Get Domain →
                    </Link>
                  ) : (
                    <button
                      disabled={data.purchasesEnabled === false}
                      onClick={() => choose(c)}
                    >
                      Review domain order
                    </button>
                  ))}
              </article>
            ))}
          </div>
        </section>
        <section className={styles.section}>
          <h2>Clear registration and renewal prices</h2>
          <p className={styles.note}>
            Prices are per year in NGN. Registration and renewal are charged
            separately. No automatic renewal charges.
          </p>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Extension</th>
                  <th>Registration / year</th>
                  <th>Renewal / year</th>
                  <th>Transfer</th>
                  <th>Requirements</th>
                </tr>
              </thead>
              <tbody>
                {data.prices.map((p) => (
                  <tr key={text(p, "extension")}>
                    <td>
                      <strong>{text(p, "extension")}</strong>
                    </td>
                    <td>{money(p.registration_price)}</td>
                    <td>{money(p.renewal_price)}</td>
                    <td>
                      {p.transfer_price
                        ? money(p.transfer_price)
                        : "Request a quote"}
                    </td>
                    <td>
                      {text(p, "requirements") ||
                        "Subject to registry eligibility."}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.prices.length && (
            <p>
              No extensions are available for checkout yet. Please check back
              shortly.
            </p>
          )}
        </section>
        {selected && (
          <section className={styles.section} id="domain-checkout">
            <h2>
              {selected.kind === "RENEW" ? "Renew" : "Register"}{" "}
              {selected.domain}
            </h2>
            <form
              className={styles.form}
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setMessage("");
                try {
                  const r = await createDomainOrderAction({
                    domain: selected.domain,
                    extension: selected.extension,
                    kind: selected.kind,
                    assetId: selected.assetId,
                    years,
                    priceRevision: Number(selected.price.revision),
                    registrant: contact,
                    consent,
                    termsVersion: DOMAIN_TERMS,
                  });
                  if (r.ok) window.location.assign(r.data.url);
                  else {
                    setMessage(r.error);
                    await load();
                  }
                } catch {
                  setMessage(
                    "Checkout could not be opened. Check My Domains before trying another order.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <fieldset disabled={busy}>
                <legend>
                  Registrant contact — the legitimate owner of this domain
                </legend>
                <div className={styles.fields}>
                  {contactFields.map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        required={key !== "company"}
                        type={
                          key === "email"
                            ? "email"
                            : key === "phone"
                              ? "tel"
                              : "text"
                        }
                        maxLength={
                          key === "country" ? 2 : key === "address" ? 250 : 200
                        }
                        value={contact[key]}
                        onChange={(e) =>
                          setContact((s) => ({ ...s, [key]: e.target.value }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <label>
                  Registration period
                  <select
                    value={years}
                    onChange={(e) => setYears(Number(e.target.value))}
                  >
                    {Array.from(
                      { length: Number(selected.price.max_years) },
                      (_, i) => (
                        <option key={i} value={i + 1}>
                          {i + 1} year(s)
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <div className={styles.quote}>
                  <p>
                    {selected.kind === "REGISTER" ? "Registration" : "Renewal"}{" "}
                    total: <strong>{money(unit * years)}</strong>
                  </p>
                  <p>
                    Current future renewal price:{" "}
                    <strong>
                      {money(selected.price.renewal_price)} / year
                    </strong>
                  </p>
                  <p>{text(selected.price, "requirements")}</p>
                </div>
                <label className={styles.consent}>
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>
                    I am the registrant or have their permission. I accept the{" "}
                    <Link href="/domain-terms" target="_blank">
                      Domain terms
                    </Link>{" "}
                    and approve this one-off payment. Availability is not
                    guaranteed until the registrar confirms. No domain is bought
                    automatically after payment.
                  </span>
                </label>
                <p className={styles.note}>
                  Secure registrant details are used for fulfillment. A website
                  plan is not required to buy a domain; connecting it to a JKTL
                  website follows the existing website-plan requirements. Domain
                  failures are eligible for a full-refund review.
                </p>
                <button type="submit">
                  Pay {money(unit * years)} securely
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => setSelected(null)}
                >
                  Close order review
                </button>
              </fieldset>
            </form>
          </section>
        )}
        <p role="status" className={styles.feedback}>
          {message}
        </p>
        <section className={styles.section}>
          <h2>My Domains</h2>
          {!data.assets.length && (
            <p>
              Your domains appear here only after the registrar confirms
              registration.
            </p>
          )}
          <div className={styles.cards}>
            {data.assets.map((a) => (
              <article key={text(a, "id")}>
                <h3>{text(a, "domain")}</h3>
                <span className={styles.status}>
                  ACTIVE
                  {new Date(text(a, "expires_at")).getTime() < now
                    ? " · expired — contact support"
                    : ""}
                </span>
                <dl>
                  <dt>Registered</dt>
                  <dd>{date(a.registered_at)}</dd>
                  <dt>Expires</dt>
                  <dd>{date(a.expires_at)}</dd>
                  <dt>Current renewal price</dt>
                  <dd>
                    {a.enabled && a.renewal_price
                      ? money(a.renewal_price) + " / year"
                      : "Contact support for a renewal quote"}
                  </dd>
                  <dt>Assigned website</dt>
                  <dd>{text(a, "display_name") || "Not assigned"}</dd>
                  <dt>Connection</dt>
                  <dd>{text(a, "connection_status")}</dd>
                  <dt>Nameservers</dt>
                  <dd>
                    {Array.isArray(a.nameservers)
                      ? a.nameservers.join(", ")
                      : "—"}
                  </dd>
                </dl>
                <div className={styles.actions}>
                  <button
                    disabled={
                      busy ||
                      !a.enabled ||
                      new Date(text(a, "expires_at")).getTime() <= now
                    }
                    onClick={() => {
                      const price = data.prices.find(
                        (p) => p.extension === a.extension,
                      );
                      if (price) {
                        setSelected({
                          domain: text(a, "domain"),
                          extension: text(a, "extension"),
                          kind: "RENEW",
                          assetId: text(a, "id"),
                          price,
                        });
                        setConsent(false);
                        setYears(1);
                        setMessage(
                          "Review the current renewal price and confirm the registrant details. Expiry changes only after registrar confirmation.",
                        );
                      }
                    }}
                  >
                    Review renewal
                  </button>
                  <button
                    disabled={busy}
                    className={styles.secondary}
                    onClick={async () => {
                      const r = await run(
                        () => requestDomainConnectionAction(text(a, "id")),
                        "Connection requested. Add the DNS records and ask JKTL to confirm hosting setup.",
                      );
                      if (r.ok && r.data)
                        setDns(r.data as Record<string, string>);
                    }}
                  >
                    Connect to my JKTL website
                  </button>
                  <button
                    disabled={busy}
                    className={styles.secondary}
                    onClick={() =>
                      void run(
                        () =>
                          verifyPurchasedDomainConnectionAction(text(a, "id")),
                        "Ownership and DNS checked. Connection is live only after JKTL confirms hosting setup.",
                      )
                    }
                  >
                    Verify DNS & connection
                  </button>
                  <button
                    className={styles.secondary}
                    onClick={() => {
                      setTaskAsset(text(a, "id"));
                      setTaskOrder("");
                      setTaskKind("SUPPORT");
                    }}
                  >
                    Request DNS, transfer or support
                  </button>
                </div>
                <p className={styles.note}>
                  Renewals are pay-per-order. Expired domains require an
                  eligibility check; do not pay another registration order for a
                  domain you already own.
                </p>
              </article>
            ))}
          </div>
          {dns && (
            <aside className={styles.notice}>
              <h3>DNS records for your connection</h3>
              <p>
                TXT name: <code>{dns.recordName}</code>
              </p>
              <p>
                TXT value: <code>{dns.recordValue}</code>
              </p>
              <p>
                CNAME target:{" "}
                <code>
                  {dns.cname || "Awaiting JKTL hosting configuration"}
                </code>
              </p>
              <p>
                Approved apex A address(es):{" "}
                <code>
                  {dns.ipv4 ||
                    "Ask JKTL if your DNS provider requires apex A records"}
                </code>
              </p>
              <p>
                JKTL must also attach the domain to the hosting project and
                confirm it. Keep your existing website/template; this connection
                does not ask you to select a new one.
              </p>
            </aside>
          )}
        </section>
        <section className={styles.section}>
          <h2>Orders and payment status</h2>
          {!data.orders.length && <p>No domain orders yet.</p>}
          <div className={styles.cards}>
            {data.orders.map((o) => (
              <article key={text(o, "id")}>
                <h3>{text(o, "domain")}</h3>
                <span className={styles.status}>
                  {text(o, "kind")} · {domainProgress(o)}
                </span>
                <p>
                  {Number(o.years)} year(s) · {money(o.amount_kobo)}
                </p>
                <p className={styles.note}>Reference: {text(o, "reference")}</p>
                {Number(o.refunded_kobo) > 0 && (
                  <p>Confirmed refund: {money(o.refunded_kobo)}</p>
                )}
                {Boolean(o.failure_reason) && (
                  <p>{text(o, "failure_reason")}</p>
                )}
                <div className={styles.actions}>
                  {o.status === "PENDING_PAYMENT" && (
                    <>
                      <button
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const r = await resumeDomainOrderAction(
                              text(o, "id"),
                            );
                            if (r.ok) window.location.assign(r.data.url);
                            else setMessage(r.error);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Continue existing payment
                      </button>
                      <button
                        disabled={busy}
                        className={styles.secondary}
                        onClick={() =>
                          void run(
                            () => cancelDomainOrderAction(text(o, "id")),
                            "Unpaid order cancelled after provider verification.",
                          )
                        }
                      >
                        Cancel failed / abandoned payment
                      </button>
                    </>
                  )}
                  <button
                    disabled={busy}
                    className={styles.secondary}
                    onClick={() =>
                      void run(
                        () => verifyDomainPaymentAction(text(o, "reference")),
                        "Payment status checked. Refresh My Domains for the verified order status.",
                      )
                    }
                  >
                    Check payment status
                  </button>
                  {o.status === "FAILED" && Boolean(o.paid_at) && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            requestDomainRefundAction(
                              text(o, "id"),
                              "The paid domain order failed. Please process the full refund.",
                            ),
                          "Full refund requested. It remains pending until the payment provider confirms.",
                        )
                      }
                    >
                      Request full refund
                    </button>
                  )}
                  <button
                    className={styles.secondary}
                    onClick={() => {
                      setTaskOrder(text(o, "id"));
                      setTaskAsset("");
                      setTaskKind("SUPPORT");
                    }}
                  >
                    Contact domain support
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
        {(taskAsset || taskOrder) && (
          <section className={styles.section}>
            <h2>Request a domain change</h2>
            <form
              className={styles.form}
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await run(
                  () =>
                    taskAsset
                      ? requestDomainTaskAction(taskAsset, taskKind, taskText)
                      : requestOrderSupportAction(taskOrder, taskText),
                  "Your request is queued for JKTL. No registrar settings have been changed automatically.",
                );
                if (r.ok) {
                  setTaskAsset("");
                  setTaskOrder("");
                  setTaskText("");
                }
              }}
            >
              {taskAsset && (
                <label>
                  Request type
                  <select
                    value={taskKind}
                    onChange={(e) => setTaskKind(e.target.value)}
                  >
                    <option value="SUPPORT">Support</option>
                    <option value="DNS">DNS record change</option>
                    <option value="NAMESERVERS">Nameserver change</option>
                    <option value="TRANSFER">Transfer assistance</option>
                  </select>
                </label>
              )}
              <label>
                Requested change
                <textarea
                  required
                  minLength={5}
                  maxLength={2000}
                  rows={4}
                  value={taskText}
                  onChange={(e) => setTaskText(e.target.value)}
                />
              </label>
              <p className={styles.note}>
                Do not include passwords, payment-card details or transfer
                codes. Transfers remain subject to registrar/registry
                eligibility and lock periods.
              </p>
              <button disabled={busy}>Send request</button>
            </form>
          </section>
        )}
        <section className={styles.section}>
          <h2>My requests</h2>
          {data.tasks.map((t) => (
            <article key={text(t, "id")} className={styles.request}>
              <strong>
                {text(t, "kind")} · {text(t, "status")}
              </strong>
              <p>{text(t, "message")}</p>
              {Boolean(t.admin_note) && <p>JKTL: {text(t, "admin_note")}</p>}
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
