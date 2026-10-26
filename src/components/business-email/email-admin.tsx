"use client";
import { useState } from "react";
import * as actions from "@/lib/actions/business-email-actions";
import styles from "@/components/domains/domains.module.css";
type Row = Record<string, unknown>;
type Data = {
  grossPaidKobo?: number;
  plans: Row[];
  services: Row[];
  orders: Row[];
  mailboxes: Row[];
  requests: Row[];
  audit: Row[];
  overrides: Row[];
  organizations: Row[];
};
const value = (d: FormData, k: string) => String(d.get(k) || "");
const money = (v: unknown) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
    Number(v) / 100,
  );
export function EmailAdmin({ initial }: { initial: Data }) {
  const [data, setData] = useState(initial),
    [tab, setTab] = useState("Overview"),
    [editingPlan, setEditingPlan] = useState("starter"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [now] = useState(() => Date.now());
  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    try {
      const r = await fn();
      setMessage(r.ok ? "Saved." : r.error || "Could not save.");
      if (r.ok) {
        const latest = await actions.adminEmailAction();
        if (latest.ok) setData(latest.data);
      }
    } catch {
      setMessage(
        "Could not save. Check configuration and your team member session.",
      );
    } finally {
      setBusy(false);
    }
  }
  const upcoming = data.services.filter(
    (s) =>
      s.renews_at &&
      new Date(String(s.renews_at)).getTime() > now &&
      new Date(String(s.renews_at)).getTime() < now + 30 * 86400000,
  );
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p>JKTL TEAM / BUSINESS EMAIL</p>
        <h1>
          Professional email.
          <br />
          Carefully managed.
        </h1>
        <p>
          Review customers, licensed services, setup requests and renewals. Paid
          checkout is controlled separately for each plan.
        </p>
      </header>
      <div className={styles.body}>
        <nav className={styles.adminTabs}>
          {[
            "Overview",
            "Customers & services",
            "Orders & provisioning",
            "Mailboxes & domains",
            "Pricing plans",
            "Renewals",
            "Support",
            "Audit",
          ].map((t) => (
            <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </nav>
        {message && (
          <p role="status" className={styles.notice}>
            {message}
          </p>
        )}
        {tab === "Overview" && (
          <>
            <section className={styles.cards}>
              {[
                [
                  "Email customers",
                  new Set(data.services.map((s) => s.organization_id)).size,
                ],
                [
                  "Active subscriptions",
                  data.services.filter(
                    (s) => s.status === "ACTIVE" && s.license_type === "PAID",
                  ).length,
                ],
                [
                  "Pending setup",
                  data.services.filter((s) =>
                    [
                      "AWAITING_DOMAIN_VERIFICATION",
                      "PENDING_SETUP",
                      "CONFIGURING",
                    ].includes(String(s.status)),
                  ).length,
                ],
                [
                  "Active mailboxes",
                  data.mailboxes.filter(
                    (b) =>
                      b.status === "ALLOCATED" &&
                      data.services.some(
                        (s) => s.id === b.service_id && s.status === "ACTIVE",
                      ),
                  ).length,
                ],
                ["Upcoming renewals", upcoming.length],
                [
                  "Expired periods",
                  data.services.filter(
                    (s) =>
                      s.renews_at &&
                      new Date(String(s.renews_at)).getTime() < now,
                  ).length,
                ],
                [
                  "Verified payments (gross)",
                  money(
                    data.grossPaidKobo ??
                      data.orders
                        .filter((o) => o.paid_at)
                        .reduce((sum, o) => sum + Number(o.amount_kobo), 0),
                  ),
                ],
              ].map(([label, n]) => (
                <article key={String(label)}>
                  <p className={styles.note}>{label}</p>
                  <h2>{n}</h2>
                </article>
              ))}
            </section>
            <section className={styles.section}>
              <h2>Provisioning checklist</h2>
              <ol>
                <li>Confirm domain ownership and the paid order.</li>
                <li>
                  Procure a properly licensed paid Zoho Mail service for paid
                  packages.
                </li>
                <li>
                  Review MX, SPF, DKIM, DMARC and verification records before
                  any DNS changes.
                </li>
                <li>
                  Create the requested mailboxes and test sending and receiving.
                </li>
                <li>
                  Record actual service dates, provider reference and secure
                  access URLs.
                </li>
                <li>
                  Mark Active only after completing the checks. Do not store
                  mailbox passwords.
                </li>
              </ol>
            </section>
          </>
        )}
        {tab === "Customers & services" && (
          <>
            <section className={styles.section}>
              <h2>Link an existing email service</h2>
              <p>
                Linking records metadata only. It does not migrate, modify or
                bill an existing mailbox. Free provider services remain free;
                any management fee is recorded for a separate agreement, not
                charged.
              </p>
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  run(() =>
                    actions.linkExistingEmailAction({
                      organizationId: value(d, "org"),
                      domain: value(d, "domain"),
                      mailboxes: value(d, "mailboxes"),
                      mailboxLimit: Number(d.get("limit")),
                      storageGb: Number(d.get("storage")),
                      providerPlan: value(d, "provider"),
                      providerReference: value(d, "reference"),
                      licenseType: value(d, "license"),
                      status: value(d, "status"),
                      renewsAt: value(d, "renewal"),
                      managementFeeKobo: Number(d.get("fee")),
                      ownershipConfirmed: d.get("ownership") === "on",
                    }),
                  );
                }}
              >
                <label>
                  Organization
                  <select name="org" required>
                    {data.organizations.map((o) => (
                      <option value={String(o.id)} key={String(o.id)}>
                        {String(o.name)}
                      </option>
                    ))}
                  </select>
                </label>
                {[
                  ["domain", "Existing domain"],
                  ["provider", "Internal provider plan"],
                  ["reference", "Provider service reference"],
                ].map(([k, l]) => (
                  <label key={k}>
                    {l}
                    <input name={k} required />
                  </label>
                ))}
                <label>
                  Existing mailbox addresses
                  <textarea name="mailboxes" required />
                </label>
                <div className={styles.fields}>
                  <label>
                    Mailbox allowance
                    <input
                      name="limit"
                      type="number"
                      min={1}
                      max={1000}
                      required
                    />
                  </label>
                  <label>
                    Storage GB per mailbox
                    <input name="storage" type="number" min={1} required />
                  </label>
                  <label>
                    Provider licence
                    <select name="license">
                      <option value="LEGACY_FREE">Existing free service</option>
                      <option value="PAID">Existing paid service</option>
                    </select>
                  </label>
                  <label>
                    Status
                    <select name="status">
                      <option>ACTIVE</option>
                      <option>CONFIGURING</option>
                      <option>SUSPENDED</option>
                    </select>
                  </label>
                  <label>
                    Renewal date, if applicable
                    <input name="renewal" type="date" />
                  </label>
                  <label>
                    Optional management fee (kobo, record only)
                    <input name="fee" type="number" min={0} defaultValue={0} />
                  </label>
                </div>
                <label className={styles.consent}>
                  <input name="ownership" type="checkbox" required />I verified
                  the existing customer, domain ownership, mailboxes and
                  provider service. No new charge or mailbox change is
                  authorized.
                </label>
                <button disabled={busy}>Link existing service</button>
              </form>
            </section>
            {data.services.map((s) => (
              <article key={String(s.id)} className={styles.section}>
                <h2>{String(s.domain)}</h2>
                <p>
                  {String(s.organization_name)} · {String(s.status)} ·{" "}
                  {String(s.license_type)} · {String(s.provider_plan)}
                </p>
                <p>
                  {String(s.mailbox_limit)} mailboxes · {String(s.storage_gb)}{" "}
                  GB per mailbox · renews{" "}
                  {String(s.renews_at || "not scheduled")}
                </p>
              </article>
            ))}
          </>
        )}
        {tab === "Pricing plans" && (
          <>
            <nav
              className={styles.adminTabs}
              aria-label="Choose email plan to edit"
            >
              {data.plans.map((p) => (
                <button
                  key={String(p.id)}
                  aria-pressed={editingPlan === p.id}
                  onClick={() => setEditingPlan(String(p.id))}
                >
                  {String(p.name)}
                </button>
              ))}
            </nav>
            {data.plans
              .filter((p) => p.id === editingPlan)
              .map((p) => (
                <section
                  key={String(p.id) + p.revision}
                  className={styles.section}
                >
                  <h2>{String(p.name)}</h2>
                  <form
                    className={styles.form}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const d = new FormData(e.currentTarget);
                      const fields: Row = { ...p };
                      for (const k of ["name", "description"])
                        fields[k] = value(d, k);
                      for (const k of [
                        "period_months",
                        "mailbox_limit",
                        "storage_gb",
                      ])
                        fields[k] = Number(d.get(k));
                      for (const k of ["price_kobo", "procurement_cost_kobo"])
                        fields[k] =
                          value(d, k) === "" ? null : Number(d.get(k));
                      fields.reminder_days =
                        value(d, "reminders").trim() === ""
                          ? []
                          : value(d, "reminders")
                              .split(",")
                              .map((v) => Number(v.trim()));
                      fields.features = value(d, "features")
                        .split("\n")
                        .filter(Boolean);
                      for (const k of [
                        "enabled",
                        "publicly_available",
                        "purchasable",
                        "recommended",
                        "resale_confirmed",
                        "paid_license_confirmed",
                        "features_confirmed",
                      ])
                        fields[k] = d.get(k) === "on";
                      run(() => actions.saveEmailPlanAction(fields));
                    }}
                  >
                    <div className={styles.fields}>
                      {[
                        ["name", "Name"],
                        ["description", "Description"],
                        ["price_kobo", "Retail price (kobo, blank for quote)"],
                        ["period_months", "Billing period (months)"],
                        ["mailbox_limit", "Mailbox allowance"],
                        ["storage_gb", "Storage GB per mailbox"],
                        [
                          "procurement_cost_kobo",
                          "Confirmed procurement cost (kobo)",
                        ],
                      ].map(([k, l]) => (
                        <label key={k}>
                          {l}
                          <input
                            name={k}
                            type={
                              ["name", "description"].includes(k)
                                ? "text"
                                : "number"
                            }
                            defaultValue={String(p[k] ?? "")}
                            min={0}
                            required={[
                              "name",
                              "description",
                              "period_months",
                              "mailbox_limit",
                              "storage_gb",
                            ].includes(k)}
                          />
                        </label>
                      ))}
                    </div>
                    <label>
                      Reminder days before renewal (comma separated, 0 = renewal
                      date; blank disables)
                      <input
                        name="reminders"
                        defaultValue={
                          Array.isArray(p.reminder_days)
                            ? p.reminder_days.join(",")
                            : "30,14,7,0"
                        }
                      />
                    </label>
                    <label>
                      Plan features (one per line)
                      <textarea
                        name="features"
                        defaultValue={(p.features as string[]).join("\n")}
                        required
                      />
                    </label>
                    {[
                      ["enabled", "Plan enabled"],
                      ["publicly_available", "Show publicly"],
                      ["purchasable", "Open checkout"],
                      ["recommended", "Most popular"],
                      [
                        "resale_confirmed",
                        "Resale/provisioning rights confirmed",
                      ],
                      [
                        "paid_license_confirmed",
                        "Paid service licensing confirmed (not free accounts)",
                      ],
                      [
                        "features_confirmed",
                        "Advertised features and provider costs verified",
                      ],
                    ].map(([k, l]) => (
                      <label key={k} className={styles.consent}>
                        <input
                          name={k}
                          type="checkbox"
                          defaultChecked={Boolean(p[k])}
                        />
                        {l}
                      </label>
                    ))}
                    <button disabled={busy}>Save plan configuration</button>
                  </form>
                </section>
              ))}
            <section className={styles.section}>
              <h2>Customer-specific price</h2>
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  run(() =>
                    actions.saveEmailOverrideAction(
                      value(d, "org"),
                      value(d, "plan"),
                      Number(d.get("price")),
                      value(d, "note"),
                    ),
                  );
                }}
              >
                <label>
                  Organization
                  <select name="org">
                    {data.organizations.map((o) => (
                      <option key={String(o.id)} value={String(o.id)}>
                        {String(o.name)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Plan
                  <select name="plan">
                    {data.plans.map((p) => (
                      <option key={String(p.id)} value={String(p.id)}>
                        {String(p.name)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Agreed price (kobo)
                  <input type="number" name="price" min={1} required />
                </label>
                <label>
                  Customer-visible agreement / fee breakdown
                  <textarea name="note" required />
                </label>
                <button disabled={busy}>Save negotiated price</button>
              </form>
              <p className={styles.note}>
                Overrides affect future orders only. Existing orders and service
                periods retain their agreed price.
              </p>
              {data.overrides.map((o) => (
                <p key={String(o.organization_id) + o.plan_id}>
                  {String(o.organization_id)} · {String(o.plan_id)} ·{" "}
                  {money(o.price_kobo)} · {String(o.note)}
                </p>
              ))}
            </section>
          </>
        )}
        {tab === "Orders & provisioning" && (
          <>
            {data.orders.map((o) => (
              <article className={styles.section} key={String(o.id)}>
                <h3>
                  {String(o.domain)} · {String(o.plan_name)}
                </h3>
                <p>
                  {String(o.kind)} · {String(o.status)} · {money(o.amount_kobo)}{" "}
                  / {String(o.period_months)} months
                </p>
                <p className={styles.note}>
                  Reference {String(o.reference)} ·{" "}
                  {o.paid_at
                    ? "Verified payment"
                    : "Payment not verified; do not provision"}
                </p>
                <p>
                  Requested mailboxes: {(o.mailboxes as string[]).join(", ")}
                </p>
              </article>
            ))}
            {data.services.map((s) => (
              <ServiceForm
                key={String(s.id) + s.revision}
                service={s}
                orders={data.orders.filter(
                  (o) =>
                    o.service_id === s.id && o.paid_at && o.status !== "ACTIVE",
                )}
                busy={busy}
                run={run}
              />
            ))}
          </>
        )}
        {tab === "Mailboxes & domains" &&
          data.services.map((s) => (
            <section key={String(s.id) + s.revision} className={styles.section}>
              <h2>{String(s.domain)}</h2>
              <p>
                Ownership{" "}
                {s.verified_at ? "verified" : "awaiting TXT verification"} ·{" "}
                {String(s.status)}
              </p>
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  run(() =>
                    actions.recordEmailMailboxesAction(
                      String(s.id),
                      Number(s.revision),
                      value(d, "addresses"),
                      value(d, "note"),
                    ),
                  );
                }}
              >
                <label>
                  Confirmed allocated mailbox addresses
                  <textarea
                    name="addresses"
                    defaultValue={data.mailboxes
                      .filter(
                        (b) =>
                          b.service_id === s.id && b.status === "ALLOCATED",
                      )
                      .map((b) => b.address)
                      .join("\n")}
                  />
                </label>
                <label>
                  Provider action confirmation / reference
                  <textarea name="note" required />
                </label>
                <p className={styles.note}>
                  Make changes at the provider first. Record only completed,
                  licensed mailbox changes within the allowance. No passwords.
                </p>
                <button disabled={busy}>Record confirmed mailboxes</button>
              </form>
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {JSON.stringify(s.dns_records, null, 2)}
              </pre>
            </section>
          ))}
        {tab === "Renewals" && (
          <section className={styles.section}>
            <h2>Renewal tracking</h2>
            <p>
              Reminder days are configurable per plan. Defaults are 30, 14, 7
              days before and on renewal date. No automatic suspension or
              deletion occurs.
            </p>
            {data.services
              .filter((s) => s.renews_at)
              .map((s) => (
                <p key={String(s.id)}>
                  {String(s.domain)} · {String(s.renews_at)} ·{" "}
                  {String(s.status)} ·{" "}
                  {s.period_price_kobo
                    ? money(s.period_price_kobo)
                    : "Existing arrangement"}
                </p>
              ))}
          </section>
        )}
        {tab === "Support" &&
          data.requests.map((r) => (
            <section key={String(r.id)} className={styles.section}>
              <h2>
                {String(r.domain)} · {String(r.kind)}
              </h2>
              <p>{String(r.message)}</p>
              <p>{String(r.status)}</p>
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  run(() =>
                    actions.replyEmailRequestAction(
                      String(r.id),
                      value(d, "status"),
                      value(d, "reply"),
                    ),
                  );
                }}
              >
                <label>
                  Status
                  <select name="status">
                    <option>PROCESSING</option>
                    <option>COMPLETED</option>
                    <option>DECLINED</option>
                  </select>
                </label>
                <label>
                  Customer-visible update
                  <textarea
                    name="reply"
                    required
                    defaultValue={String(r.reply)}
                  />
                </label>
                <button disabled={busy}>Update request</button>
              </form>
            </section>
          ))}
        {tab === "Audit" && (
          <section className={styles.section}>
            <h2>Recent activity</h2>
            {data.audit.map((a) => (
              <p className={styles.note} key={String(a.id)}>
                {String(a.event)} · {String(a.actor_id)} ·{" "}
                {String(a.created_at)} · {JSON.stringify(a.detail)}
              </p>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
function ServiceForm({
  service: s,
  orders,
  busy,
  run,
}: {
  service: Row;
  orders: Row[];
  busy: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  return (
    <section className={styles.section}>
      <h2>Configure {String(s.domain)}</h2>
      <p>
        Domain ownership {s.verified_at ? "verified" : "not yet verified"} ·
        licence {String(s.license_type)}
      </p>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          let dns;
          try {
            dns = JSON.parse(value(d, "dns"));
          } catch {
            alert("Enter valid JSON DNS records.");
            return;
          }
          run(() =>
            actions.fulfillEmailServiceAction({
              serviceId: String(s.id),
              revision: Number(s.revision),
              orderId: value(d, "order") || undefined,
              status: value(d, "status"),
              providerPlan: value(d, "provider"),
              providerReference: value(d, "reference"),
              licenseType: value(d, "license"),
              dns,
              sendReceiveConfirmed: d.get("tested") === "on",
              dnsConfirmed: d.get("dnsConfirmed") === "on",
              webmailUrl: value(d, "webmail"),
              activationUrl: value(d, "activation"),
              startsAt: value(d, "start"),
              renewsAt: value(d, "renewal"),
              note: value(d, "note"),
            }),
          );
        }}
      >
        <label>
          Verified paid order
          <select name="order">
            <option value="">Existing linked service / no paid order</option>
            {orders.map((o) => (
              <option key={String(o.id)} value={String(o.id)}>
                {String(o.kind)} · {String(o.plan_name)} · {String(o.reference)}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.fields}>
          <label>
            Status
            <select name="status" defaultValue={String(s.status)}>
              {[
                "CONFIGURING",
                "ACTIVE",
                "SETUP_FAILED",
                "SUSPENDED",
                "CANCELLED",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Licence
            <select name="license" defaultValue={String(s.license_type)}>
              <option>PAID</option>
              <option>LEGACY_FREE</option>
            </select>
          </label>
          <label>
            Provider plan (internal)
            <input
              name="provider"
              defaultValue={String(s.provider_plan)}
              required
            />
          </label>
          <label>
            Provider service reference
            <input
              name="reference"
              defaultValue={String(s.provider_reference)}
              required
            />
          </label>
          <label>
            Webmail URL
            <input
              name="webmail"
              type="url"
              defaultValue={String(s.webmail_url)}
            />
          </label>
          <label>
            Secure activation / password setup URL
            <input
              name="activation"
              type="url"
              defaultValue={String(s.activation_url)}
            />
          </label>
          <label>
            Actual start (Nigeria / WAT)
            <input name="start" type="datetime-local" />
          </label>
          <label>
            Actual renewal (Nigeria / WAT)
            <input name="renewal" type="datetime-local" />
          </label>
        </div>
        <label>
          Confirmed DNS records (JSON array: type, name, value, MX priority)
          <textarea
            name="dns"
            defaultValue={JSON.stringify(s.dns_records, null, 2)}
            required
            rows={7}
          />
        </label>
        <label className={styles.consent}>
          <input
            type="checkbox"
            name="dnsConfirmed"
            defaultChecked={Boolean(s.dns_confirmed)}
          />
          DNS checked, including MX, SPF, DKIM and DMARC
        </label>
        <label className={styles.consent}>
          <input
            type="checkbox"
            name="tested"
            defaultChecked={Boolean(s.send_receive_confirmed)}
          />
          Sending and receiving tested using the licensed provider service
        </label>
        <label>
          Customer-visible setup update (no passwords or internal credentials)
          <textarea name="note" required />
        </label>
        <button disabled={busy}>Record service update</button>
      </form>
    </section>
  );
}
