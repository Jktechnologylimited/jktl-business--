"use client";
import { useEffect, useState } from "react";
import * as actions from "@/lib/actions/custom-portal-actions";
import { PORTAL_SCOPES, invoiceStatus } from "@/lib/custom/portal-labels";
import styles from "@/components/domains/domains.module.css";
type Row = Record<string, unknown>;
const value = (f: FormData, key: string) => String(f.get(key) || "");
const money = (n: unknown) =>
  (Number(n || 0) / 100).toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
  });
export function PortalAdmin({ projects }: { projects: Row[] }) {
  const [data, setData] = useState<Awaited<
      ReturnType<typeof actions.customPortalOverviewAction>
    > | null>(null),
    [message, setMessage] = useState(""),
    [secret, setSecret] = useState(""),
    [busy, setBusy] = useState(false),
    [project, setProject] = useState(""),
    [status, setStatus] = useState(""),
    [due, setDue] = useState(""),
    [customer, setCustomer] = useState("");
  const load = async () => setData(await actions.customPortalOverviewAction());
  useEffect(() => {
    const timer = setTimeout(
      () =>
        void load().catch(() =>
          setMessage("Apply migration 067 to enable the project portal."),
        ),
      0,
    );
    return () => clearTimeout(timer);
  }, []);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    setSecret("");
    try {
      const result = await fn();
      if (result && typeof result === "object" && "key" in result)
        setSecret(String(result.key));
      await load();
      setMessage("Saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  }
  const projectSelect = (
    <select name="projectId" required>
      {projects.map((p) => (
        <option key={String(p.id)} value={String(p.id)}>
          {String(p.name)}
        </option>
      ))}
    </select>
  );
  const scopeFields = (
    <fieldset>
      <legend>Explicit permissions</legend>
      {PORTAL_SCOPES.map((scope) => (
        <label key={scope} className="mr-3 inline-flex gap-2">
          <input type="checkbox" name="scopes" value={scope} defaultChecked />
          {scope}
        </label>
      ))}
    </fieldset>
  );
  return (
    <div className="space-y-6">
      {message && (
        <p role="status" className={styles.notice}>
          {message}
        </p>
      )}
      {secret && (
        <div className={styles.notice}>
          <b>Copy this server-only integration key now. It is shown once.</b>
          <code className="block break-all">{secret}</code>
        </div>
      )}
      {data && (
        <section className={styles.section}>
          <h2>Project billing overview</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {Object.entries(data.summary).map(([label, n]) => (
              <div key={label}>
                <p>{label.replaceAll("_", " ")}</p>
                <b>{label.endsWith("kobo") ? money(n) : String(n)}</b>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className={styles.section}>
        <h2>Create JKTL invoice</h2>
        <p>
          Prices are project-specific. Amounts below are in NGN. Issued line
          items are locked; void unpaid invoices and replace them with an
          audited invoice.
        </p>
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget,
              f = new FormData(form);
            void run(async () => {
              const items = value(f, "items")
                .split("\n")
                .filter(Boolean)
                .map((line) => {
                  const [description, quantity, price] = line.split("|");
                  return {
                    description: description.trim(),
                    quantity: Number(quantity),
                    unitKobo: Math.round(Number(price) * 100),
                  };
                });
              const instalments = value(f, "instalments")
                .split("\n")
                .filter(Boolean)
                .map((line) => {
                  const [dueOn, price] = line.split("|");
                  return {
                    dueOn: dueOn.trim(),
                    amountKobo: Math.round(Number(price) * 100),
                  };
                });
              await actions.createProjectInvoiceAction({
                projectId: value(f, "projectId"),
                dueOn: value(f, "dueOn"),
                items,
                instalments,
                issue: f.get("issue") === "on",
              });
              form.reset();
            });
          }}
        >
          <label>Project{projectSelect}</label>
          <label>
            Due date
            <input type="date" name="dueOn" required />
          </label>
          <label>
            Line items: description | quantity | unit price (NGN)
            <textarea
              name="items"
              required
              placeholder={"Annual cloud infrastructure | 1 | 299000"}
              rows={4}
            />
          </label>
          <label>
            Optional instalments: YYYY-MM-DD | amount (NGN)
            <textarea
              name="instalments"
              placeholder={"2026-11-15 | 119600\n2026-12-15 | 179400"}
              rows={3}
            />
          </label>
          <label>
            <input type="checkbox" name="issue" />
            Issue immediately (otherwise save draft)
          </label>
          <button disabled={busy}>Create invoice</button>
        </form>
      </section>
      {data && (
        <section className={styles.section}>
          <h2>Invoices & verified payments</h2>
          <div className="flex flex-wrap gap-3">
            <label>
              Project
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
              >
                <option value="">All projects</option>
                {projects.map((p) => (
                  <option value={String(p.id)} key={String(p.id)}>
                    {String(p.name)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                {[
                  "DRAFT",
                  "ISSUED",
                  "PARTIALLY_PAID",
                  "PAID",
                  "OVERDUE",
                  "VOID",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Customer
              <input
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
              />
            </label>
            <label>
              Due by
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Invoice / Project</th>
                  <th>Total / Paid / Outstanding</th>
                  <th>Status / Due</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices
                  .filter(
                    (i) =>
                      (!project || i.project_id === project) &&
                      (!status || invoiceStatus(i) === status) &&
                      (!due || String(i.due_on).slice(0, 10) <= due) &&
                      (!customer ||
                        String(i.organization)
                          .toLowerCase()
                          .includes(customer.toLowerCase())),
                  )
                  .map((i) => (
                    <tr key={String(i.id)}>
                      <td>
                        {String(i.invoice_number || i.description)}
                        <br />
                        {String(i.project_label)} · {String(i.organization)}
                      </td>
                      <td>
                        {money(i.amount_kobo)} / {money(i.paid_kobo)} /{" "}
                        {money(Number(i.amount_kobo) - Number(i.paid_kobo))}
                      </td>
                      <td>
                        {String(invoiceStatus(i))}
                        <br />
                        {String(i.due_on).slice(0, 10)}
                      </td>
                      <td>
                        <a href={"/api/admin/custom-invoices/" + i.id + "/pdf"}>
                          PDF
                        </a>
                        {Boolean(i.payment_review)&&<button disabled={busy} onClick={()=>{const reason=prompt('Enter the verified reconciliation evidence and decision. This does not change payment amounts.');if(reason)void run(()=>actions.completeProjectPaymentReviewAction(String(i.id),reason));}}>Complete reconciliation</button>}
                        {i.version === 2 && i.status === "DRAFT" && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              run(() =>
                                actions.projectInvoiceStateAction(
                                  String(i.id),
                                  "issue",
                                ),
                              )
                            }
                          >
                            Issue
                          </button>
                        )}
                        {i.version === 2 &&
                          ["DRAFT", "OPEN"].includes(String(i.status)) &&
                          Number(i.paid_kobo) === 0 && (
                            <button
                              disabled={busy}
                              onClick={() => {
                                if (
                                  confirm(
                                    "Void this invoice? Payment history is retained.",
                                  )
                                )
                                  void run(() =>
                                    actions.projectInvoiceStateAction(
                                      String(i.id),
                                      "void",
                                    ),
                                  );
                              }}
                            >
                              Void
                            </button>
                          )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <h3 className="mt-5">Recent project payment attempts</h3>
          {!data.payments.length && <p>No verified project portal payments.</p>}
          {data.payments.map((p) => (
            <p className="break-words" key={String(p.reference)}>
              {money(p.amount_kobo)} · {String(p.reference)} · {String(p.state)}{" "}
              · Refunded {money(p.refunded_kobo)}
              {p.state !== "success" && (
                <button
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      actions.reconcileProjectPaymentAction(
                        String(p.reference),
                      ),
                    )
                  }
                >
                  Verify with Paystack
                </button>
              )}
            </p>
          ))}
        </section>
      )}
      <section className={styles.section}>
        <h2>Independent website integration</h2>
        <p>
          Only explicitly mapped local owners can use the server API. Keep
          credentials in the client website’s private environment variables.
        </p>
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(() =>
              actions.configureProjectPortalAction({
                projectId: value(f, "projectId"),
                enabled: f.get("enabled") === "on",
                returnPath: value(f, "returnPath"),
                localSubject: value(f, "subject") || undefined,
                email: value(f, "email") || undefined,
                scopes: f.getAll("scopes").map(String),
              }),
            );
          }}
        >
          <label>Project{projectSelect}</label>
          <label>
            Payment return path
            <input name="returnPath" defaultValue="/admin/billing" required />
          </label>
          <label>
            Existing JKTL member email
            <input name="email" type="email" />
          </label>
          <label>
            Local owner user ID
            <input name="subject" maxLength={200} />
          </label>
          {scopeFields}
          <label>
            <input name="enabled" type="checkbox" />
            Enable server integration
          </label>
          <button disabled={busy}>Save access</button>
        </form>
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (
              confirm(
                "Rotate the project key? All previous keys will stop working.",
              )
            )
              void run(() =>
                actions.rotateProjectKeyAction(
                  value(f, "projectId"),
                  value(f, "label"),
                  f.getAll("scopes").map(String),
                ),
              );
          }}
        >
          <label>Project{projectSelect}</label>
          <label>
            Key label
            <input name="label" defaultValue="Production website" required />
          </label>
          {scopeFields}
          <button disabled={busy}>Generate / rotate key</button>
        </form>
        {data?.owners.map((o) => (
          <div key={String(o.project_id) + String(o.local_subject)}>
            <p>
              {String(projects.find((p) => p.id === o.project_id)?.name)} ·{" "}
              {String(o.email)} · Local ID {String(o.local_subject)} ·{" "}
              {o.active ? "Active" : "Revoked"}
            </p>
            {Boolean(o.active) && (
              <button
                disabled={busy}
                onClick={() =>
                  run(() =>
                    actions.configureProjectPortalAction({
                      projectId: String(o.project_id),
                      localSubject: String(o.local_subject),
                      enabled: true,
                      remove: true,
                    }),
                  )
                }
              >
                Revoke owner access
              </button>
            )}
          </div>
        ))}
        {data?.keys.map((k) => (
          <p key={String(k.id)}>
            {String(k.label)} · {String(k.created_at)} ·{" "}
            {k.revoked_at ? (
              "Revoked"
            ) : (
              <button
                disabled={busy}
                onClick={() =>
                  run(() => actions.revokeProjectKeyAction(String(k.id)))
                }
              >
                Revoke key
              </button>
            )}
          </p>
        ))}
      </section>
      {data && (
        <section className={styles.section}>
          <h2>Custom project support</h2>
          <p>
            Replies, assignments, internal notes and escalation use the existing
            support inbox.
          </p>
          {data.tickets.map((c) => (
            <p key={String(c.id)}>
              <a href={"/admin/support?case=" + c.id}>
                {String(c.name)} · {String(c.subject)} · {String(c.status)}
              </a>
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
