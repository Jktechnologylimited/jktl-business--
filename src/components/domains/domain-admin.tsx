"use client";
import { useState } from "react";
import {
  adminDomainsAction,
  saveDomainPriceAction,
  confirmDomainAvailabilityAction,
  fulfillDomainOrderAction,
  completeDomainTaskAction,
  verifyDomainRefundAction,
} from "@/lib/actions/domain-order-actions";
import { money } from "@/lib/domains/model";
import styles from "./domains.module.css";
type Row = Record<string, unknown>;
type Data = {
  prices: Row[];
  orders: Row[];
  checks: Row[];
  tasks: Row[];
  audit: Row[];
};
const text = (r: Row, k: string) => String(r[k] ?? "");
export function DomainAdmin({ initial }: { initial: Data }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState("orders");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [price, setPrice] = useState<Row | null>(null);
  async function run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fn();
      setMessage(r.ok ? success : r.error || "Request failed.");
      if (r.ok) {
        const current = await adminDomainsAction();
        if (current.ok) setData(current.data);
      }
      return r;
    } catch {
      setMessage("Could not complete the request. Please retry.");
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.page}>
      <h1 className="text-3xl font-semibold">Domain operations</h1>
      <p className={styles.adminNote}>
        Manual supplier fulfillment only. A verified Paystack payment is not a
        registration. Recheck availability and registry eligibility before
        purchasing through the supplier, and record the actual confirmation.
        Never request a second customer payment for an existing order.
      </p>
      <nav className={styles.adminTabs}>
        {[
          ["orders", "Orders & refunds"],
          ["checks", "Availability checks"],
          ["prices", "Pricing"],
          ["tasks", "DNS & support tasks"],
          ["audit", "Audit trail"],
        ].map(([id, label]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      <p role="status" className={styles.feedback}>
        {message}
      </p>
      {tab === "checks" && (
        <div className={styles.adminList}>
          <h2>Manual availability queue</h2>
          <p className={styles.note}>
            Check the supplier, premium pricing and registry rules. An Available
            confirmation lasts 30 minutes and is not a reservation.
          </p>
          {data.checks.map((c) => (
            <article key={text(c, "id")} className={styles.section}>
              <h3>{text(c, "domain")}</h3>
              <p>{text(c, "display_name")}</p>
              <div className={styles.actions}>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () =>
                        confirmDomainAvailabilityAction(text(c, "id"), true),
                      "Availability recorded. The customer can review and pay within 30 minutes.",
                    )
                  }
                >
                  Confirmed available at catalogue price
                </button>
                <button
                  disabled={busy}
                  className={styles.secondary}
                  onClick={() =>
                    void run(
                      () =>
                        confirmDomainAvailabilityAction(text(c, "id"), false),
                      "Domain marked unavailable.",
                    )
                  }
                >
                  Unavailable / premium / ineligible
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {tab === "prices" && (
        <section className={styles.section}>
          <h2>Extension pricing</h2>
          <p className={styles.note}>
            Supplier costs are internal. All money fields below use whole kobo
            (₦1 = 100 kobo). Enabled customer prices appear without redeploying.
            Set the final retail price including applicable charges.
          </p>
          <button onClick={() => setPrice({})}>Add an extension</button>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Extension</th>
                  <th>Registration</th>
                  <th>Renewal</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.prices.map((p) => (
                  <tr key={text(p, "extension")}>
                    <td>{text(p, "extension")}</td>
                    <td>
                      {p.registration_price
                        ? money(p.registration_price)
                        : "Not priced"}
                    </td>
                    <td>
                      {p.renewal_price ? money(p.renewal_price) : "Not priced"}
                    </td>
                    <td>{p.enabled ? "Enabled" : "Disabled"}</td>
                    <td>
                      {new Date(text(p, "updated_at")).toLocaleString("en-NG")}
                    </td>
                    <td>
                      <button onClick={() => setPrice(p)}>Edit price</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {price && (
            <PriceForm
              key={text(price, "extension") + text(price, "revision")}
              initial={price}
              busy={busy}
              onSave={async (input) => {
                const r = await run(
                  () => saveDomainPriceAction(input),
                  "Price saved. Existing orders retain their agreed amount.",
                );
                if (r.ok) setPrice(null);
              }}
            />
          )}
        </section>
      )}
      {tab === "orders" && (
        <section className={styles.adminList}>
          <h2 className="text-xl font-semibold">Orders — latest 150</h2>
          {data.orders.map((o) => (
            <details key={text(o, "id") + "-" + text(o, "revision")}>
              <summary>
                <strong>{text(o, "domain")}</strong> · {text(o, "kind")} ·{" "}
                {text(o, "status")} · {money(o.amount_kobo)} ·{" "}
                {text(o, "display_name")}
              </summary>
              <dl>
                {[
                  ["Order ID", "id"],
                  ["Payment reference", "reference"],
                  ["Verified transaction", "provider_transaction"],
                  ["Paid at", "paid_at"],
                  ["Period (years)", "years"],
                  ["Supplier reference", "supplier_reference"],
                  ["Recorded registration", "registered_at"],
                  ["Recorded expiry", "expires_at"],
                  ["Failure / refund reason", "failure_reason"],
                ].map(([label, key]) => (
                  <div key={key} style={{ display: "contents" }}>
                    <dt>{label}</dt>
                    <dd>{text(o, key) || "—"}</dd>
                  </div>
                ))}
              </dl>
              {o.paid_at ? (
                <>
                  <h3>Registrant contact — authorized fulfillment use only</h3>
                  {o.registrant ? (
                    <dl>
                      {Object.entries(
                        o.registrant as Record<string, string>,
                      ).map(([k, v]) => (
                        <div key={k} style={{ display: "contents" }}>
                          <dt>{k}</dt>
                          <dd>{v || "—"}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className={styles.notice}>
                      Encrypted contact could not be read. Check secure
                      contact-key configuration before proceeding.
                    </p>
                  )}
                </>
              ) : (
                <p>
                  Unpaid order. Do not register it or disclose registrant
                  contact.
                </p>
              )}
              {["PAID", "PROCESSING", "FAILED"].includes(text(o, "status")) && (
                <FulfilForm
                  order={o}
                  busy={busy}
                  submit={(input) =>
                    run(
                      () => fulfillDomainOrderAction(input),
                      "Order updated and notification queued. No supplier purchase was made by the application.",
                    )
                  }
                />
              )}
              {o.status === "REFUND_PENDING" && (
                <div className={styles.notice}>
                  <h3>Full-refund queue</h3>
                  <p>
                    Verified paid amount: {money(o.amount_kobo)}.
                    Provider-confirmed refunded amount: {money(o.refunded_kobo)}
                    .
                  </p>
                  <p>
                    Use this order’s transaction in the existing Paystack
                    dashboard to issue the remaining refund. Do not refund a
                    subscription or another transaction. The signed refund
                    webhook confirms each partial/full refund.
                  </p>
                  <a
                    href="https://dashboard.paystack.com/#/transactions"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open Paystack transactions ↗
                  </a>
                  <RefundForm
                    id={text(o, "id")}
                    busy={busy}
                    submit={(refundId) =>
                      run(
                        () => verifyDomainRefundAction(text(o, "id"), refundId),
                        "Provider refund checked. The order is refunded only when the full amount is confirmed.",
                      )
                    }
                  />
                </div>
              )}
            </details>
          ))}
        </section>
      )}
      {tab === "tasks" && (
        <section className={styles.adminList}>
          <h2 className="text-xl font-semibold">Manual task queue</h2>
          {data.tasks.map((t) => (
            <details key={text(t, "id") + "-" + text(t, "updated_at")}>
              <summary>
                {text(t, "domain")} · {text(t, "kind")} · {text(t, "status")}
              </summary>
              <p className={styles.adminNote}>{text(t, "message")}</p>
              {t.kind === "CONNECT" && (
                <p className={styles.note}>
                  Attach this domain to the existing Business hosting project,
                  confirm its configuration and SSL, and record the
                  project/domain verification reference. Completing this task
                  does not bypass the customer’s TXT and routing-DNS checks.
                </p>
              )}
              <TaskForm
                task={t}
                busy={busy}
                submit={(status, note, hosting, ns) =>
                  run(
                    () =>
                      completeDomainTaskAction(
                        text(t, "id"),
                        status,
                        note,
                        hosting,
                        ns,
                      ),
                    "Task updated. Registrar changes are recorded only after manual confirmation.",
                  )
                }
              />
            </details>
          ))}
        </section>
      )}
      {tab === "audit" && (
        <section className={styles.section}>
          <h2>Audit trail — latest 100</h2>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Event</th>
                  <th>Order</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {data.audit.map((a) => (
                  <tr key={text(a, "id")}>
                    <td>
                      {new Date(text(a, "created_at")).toLocaleString("en-NG")}
                    </td>
                    <td>
                      {text(a, "actor_type")} {text(a, "actor_id")}
                    </td>
                    <td>{text(a, "event")}</td>
                    <td>{text(a, "order_id")}</td>
                    <td>
                      <pre>{JSON.stringify(a.detail)}</pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
function PriceForm({
  initial,
  busy,
  onSave,
}: {
  initial: Row;
  busy: boolean;
  onSave: (v: Parameters<typeof saveDomainPriceAction>[0]) => void;
}) {
  const [form, setForm] = useState({
    extension: text(initial, "extension"),
    supplier: text(initial, "supplier") || "GO54",
    registrationCost: Number(initial.registration_cost || 0),
    registrationPrice: Number(initial.registration_price || 0),
    renewalCost: Number(initial.renewal_cost || 0),
    renewalPrice: Number(initial.renewal_price || 0),
    transferPrice: initial.transfer_price
      ? Number(initial.transfer_price)
      : null,
    enabled: Boolean(initial.enabled),
    maxYears: Number(initial.max_years || 1),
    requirements: text(initial, "requirements"),
    revision: Number(initial.revision || 0),
  });
  return (
    <form
      className={`${styles.form} ${styles.adminForm}`}
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
    >
      <fieldset disabled={busy}>
        <legend>{form.revision ? "Edit" : "Create"} extension pricing</legend>
        <div className={styles.fields}>
          <label>
            Extension
            <input
              required
              placeholder=".com.ng"
              value={form.extension}
              disabled={form.revision > 0}
              onChange={(e) =>
                setForm((s) => ({ ...s, extension: e.target.value }))
              }
            />
          </label>
          <label>
            Supplier (internal)
            <input
              required
              value={form.supplier}
              onChange={(e) =>
                setForm((s) => ({ ...s, supplier: e.target.value }))
              }
            />
          </label>
          {(
            [
              ["registrationCost", "Supplier registration cost"],
              ["registrationPrice", "JKTL registration price"],
              ["renewalCost", "Supplier renewal cost"],
              ["renewalPrice", "JKTL renewal price"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label} (kobo)
              <input
                type="number"
                required
                min={key.endsWith("Cost") ? 0 : 1}
                step="1"
                max="1000000000"
                value={form[key]}
                onChange={(e) =>
                  setForm((s) => ({ ...s, [key]: Number(e.target.value) }))
                }
              />
            </label>
          ))}
          <label>
            Transfer price (optional, kobo)
            <input
              type="number"
              min="1"
              step="1"
              value={form.transferPrice ?? ""}
              onChange={(e) =>
                setForm((s) => ({
                  ...s,
                  transferPrice: e.target.value ? Number(e.target.value) : null,
                }))
              }
            />
          </label>
          <label>
            Maximum years per order
            <input
              type="number"
              required
              min="1"
              max="10"
              value={form.maxYears}
              onChange={(e) =>
                setForm((s) => ({ ...s, maxYears: Number(e.target.value) }))
              }
            />
          </label>
        </div>
        <label>
          Eligibility / pricing requirements
          <textarea
            maxLength={1000}
            value={form.requirements}
            onChange={(e) =>
              setForm((s) => ({ ...s, requirements: e.target.value }))
            }
          />
        </label>
        <label className={styles.consent}>
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) =>
              setForm((s) => ({ ...s, enabled: e.target.checked }))
            }
          />
          Available for customer checkout
        </label>
        <button>Save price</button>
      </fieldset>
    </form>
  );
}
function FulfilForm({
  order,
  busy,
  submit,
}: {
  order: Row;
  busy: boolean;
  submit: (
    v: Parameters<typeof fulfillDomainOrderAction>[0],
  ) => Promise<unknown>;
}) {
  const options =
    order.status === "PAID"
      ? ["PROCESSING", "FAILED"]
      : order.status === "PROCESSING"
        ? ["ACTIVE", "FAILED"]
        : order.paid_at
          ? ["REFUND_PENDING"]
          : [];
  const [status, setStatus] = useState(options[0] || "");
  const [reason, setReason] = useState("");
  const [ref, setRef] = useState("");
  const [registered, setRegistered] = useState("");
  const [expires, setExpires] = useState("");
  const [ns, setNs] = useState("");
  if (!options.length) return null;
  return (
    <form
      className={styles.taskForm}
      onSubmit={(e) => {
        e.preventDefault();
        void submit({
          id: text(order, "id"),
          revision: Number(order.revision),
          status,
          reason,
          supplierReference: ref,
          registeredAt: registered,
          expiresAt: expires,
          nameservers: ns,
        });
      }}
    >
      <fieldset disabled={busy}>
        <div className={styles.taskForm}>
          <label>
            Next fulfillment state
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {options.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          {status === "ACTIVE" ? (
            <>
              <label>
                Actual supplier transaction reference
                <input
                  required
                  minLength={3}
                  maxLength={200}
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                />
              </label>
              <label>
                Actual registration / confirmation date
                <input
                  type="date"
                  required
                  value={registered}
                  onChange={(e) => setRegistered(e.target.value)}
                />
              </label>
              <label>
                Registrar-confirmed expiry date
                <input
                  type="date"
                  required
                  value={expires}
                  onChange={(e) => setExpires(e.target.value)}
                />
              </label>
              <label>
                Confirmed nameservers
                <textarea
                  required
                  placeholder="ns1.example.com, ns2.example.com"
                  value={ns}
                  onChange={(e) => setNs(e.target.value)}
                />
              </label>
              <p className={styles.note}>
                Record only a completed supplier operation. A renewal must
                extend the previous expiry by the selected period. No domain
                purchase or renewal is performed by this form.
              </p>
            </>
          ) : status !== "PROCESSING" ? (
            <label>
              Failure / full-refund reason
              <textarea
                required
                minLength={5}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          ) : (
            <p className={styles.note}>
              Claim this order before manual supplier work. Recheck the domain
              and registrant eligibility before buying.
            </p>
          )}
          <button>Record manual fulfillment</button>
        </div>
      </fieldset>
    </form>
  );
}
function TaskForm({
  task,
  busy,
  submit,
}: {
  task: Row;
  busy: boolean;
  submit: (
    status: string,
    note: string,
    hosting?: string,
    ns?: string,
  ) => Promise<unknown>;
}) {
  const [status, setStatus] = useState("PROCESSING");
  const [note, setNote] = useState("");
  const [hosting, setHosting] = useState("");
  const [ns, setNs] = useState("");
  return (
    <form
      className={styles.taskForm}
      onSubmit={(e) => {
        e.preventDefault();
        void submit(status, note, hosting, ns);
      }}
    >
      <label>
        Task status
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option>PROCESSING</option>
          <option>COMPLETED</option>
          <option>REJECTED</option>
        </select>
      </label>
      <label>
        Customer-visible completion note
        <textarea
          required
          minLength={5}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {task.kind === "CONNECT" && (
        <label>
          Confirmed hosting project / domain reference
          <input
            value={hosting}
            onChange={(e) => setHosting(e.target.value)}
            required={status === "COMPLETED"}
          />
        </label>
      )}
      {task.kind === "NAMESERVERS" && (
        <label>
          Actual updated nameservers
          <textarea
            value={ns}
            onChange={(e) => setNs(e.target.value)}
            required={status === "COMPLETED"}
          />
        </label>
      )}
      <button disabled={busy}>Update task</button>
    </form>
  );
}
function RefundForm({
  id,
  busy,
  submit,
}: {
  id: string;
  busy: boolean;
  submit: (id: string) => Promise<unknown>;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className={styles.taskForm}
      onSubmit={(e) => {
        e.preventDefault();
        void submit(value);
      }}
    >
      <label>
        Paystack refund ID
        <input
          required
          pattern="[0-9]+"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-describedby={"refund-" + id}
        />
      </label>
      <p id={"refund-" + id} className={styles.note}>
        For a missed webhook, verify the actual refund through Paystack. A
        browser success message or typed ID alone cannot mark it refunded.
      </p>
      <button disabled={busy}>Verify provider refund</button>
    </form>
  );
}
