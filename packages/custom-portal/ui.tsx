"use client";
import {ProjectEarn} from "./earn";
import { useCallback, useEffect, useState } from "react";
type Row = Record<string, unknown>;
const money = (value: unknown) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
    Number(value || 0) / 100,
  );
export function ProjectPortal({
  endpoint,
  initialTab = "billing",
}: {
  endpoint: string;
  initialTab?: "billing" | "invoices" | "support" | "earn";
}) {
  const [tab, setTab] = useState(initialTab),
    [data, setData] = useState<Row | null>(null),
    [invoices, setInvoices] = useState<Row[]>([]),
    [cases, setCases] = useState<Row[]>([]),
    [ticket, setTicket] = useState<{ case: Row; messages: Row[] } | null>(null),
    [invoice, setInvoice] = useState<Row | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [attachments, setAttachments] = useState<Row[]>([]);
  const request = useCallback(
    async (path: string, body?: unknown) => {
      const result = await fetch(endpoint + path, {
        method: body === undefined ? "GET" : "POST",
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
      });
      const parsed = await result.json();
      if (!result.ok)
        throw Error(
          parsed.error || "JKTL is temporarily unavailable. Please retry.",
        );
      return parsed.data;
    },
    [endpoint],
  );
  const load = useCallback(async () => {
    if (tab === "billing") setData(await request("/billing"));
    if (tab === "invoices") setInvoices(await request("/invoices"));
    if (tab === "support") setCases(await request("/support"));
  }, [request, tab]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) void load().catch((e) => setMessage(e.message));
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [load]);
  useEffect(() => {
    const url = new URL(window.location.href),
      reference = url.searchParams.get("jktl_reference");
    if (!reference || !/^jktl_project_[a-f0-9]{64}$/.test(reference)) return;
    let active = true;
    void request("/payments/verify", { reference })
      .then(() => {
        if (active) {
          setMessage("Your payment has been verified.");
          void load();
        }
      })
      .catch(() => {
        if (active)
          setMessage(
            "Payment is awaiting verification. Refresh before paying again.",
          );
      });
    return () => {
      active = false;
    };
  }, [request, load]);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await task();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  }
  async function openTicket(id: unknown) {
    setTicket(await request("/support/" + id));
    setAttachments(await request("/support/" + id + "/attachments"));
  }
  const input = "w-full rounded-lg border border-current/20 bg-transparent p-3";
  const button =
    "rounded-lg border border-current/25 px-4 py-2 font-semibold disabled:opacity-50";
  const card = "rounded-2xl border border-current/15 bg-white/5 p-5";
  return (
    <section className="space-y-5" aria-label="JKTL project services">
      <nav className="flex flex-wrap gap-3" aria-label="Project services">
        {(["billing", "invoices", "support", "earn"] as const).map((t) => (
          <button
            className={button}
            key={t}
            aria-pressed={tab === t}
            onClick={() => {
              setTab(t);
              setInvoice(null);
              setTicket(null);
            }}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
        <button disabled={busy} className={button} onClick={() => run(load)}>
          Refresh
        </button>
      </nav>
      {tab === "earn" && <ProjectEarn endpoint={endpoint} />}
      {message && (
        <p role="status" className={card}>
          {message}
        </p>
      )}
      {tab === "billing" && !data && !message && (
        <p role="status">Loading JKTL services…</p>
      )}
      {tab === "billing" && data && (
        <>
          <div className={card}>
            <h2 className="text-2xl font-semibold">
              {String((data.project as Row)?.name || "Project billing")}
            </h2>
            <p>{String((data.project as Row)?.organization || "")}</p>
            <p className="mt-4 text-xl">
              Outstanding {money(data.balanceKobo)}
            </p>
            <p>Overdue {money(data.overdueKobo)}</p>
            <p className="mt-3 text-sm">
              Issuer: JK Technology Limited. Payments are verified through
              JKTL’s Paystack account. No automatic debits.
            </p>
          </div>
          <div className={card}>
            <h3 className="text-lg font-semibold">Infrastructure & services</h3>
            {(data.services as Row[]).length === 0 ? (
              <p>No services have been configured.</p>
            ) : (
              (data.services as Row[]).map((s) => (
                <div
                  className="border-t border-current/10 py-3"
                  key={String(s.id)}
                >
                  <b>{String(s.name)}</b>
                  <p>{String(s.description)}</p>
                  <p>
                    {money(Number(s.amount_kobo) - Number(s.discount_kobo))} ·{" "}
                    {String(s.interval)} · {String(s.status)}
                  </p>
                  <p>Next due: {String(s.next_due_on).slice(0, 10)}</p>
                </div>
              ))
            )}
          </div>
          <div className={card}>
            <h3 className="text-lg font-semibold">Recent payments</h3>
            {(data.payments as Row[]).length === 0 ? (
              <p>No payment records.</p>
            ) : (
              (data.payments as Row[]).map((p) => (
                <p className="break-words py-2" key={String(p.id)}>
                  {money(p.amount_kobo)} · {String(p.state)} ·{" "}
                  {String(p.reference)}
                  {Number(p.refunded_kobo) > 0 &&
                    ` · Refunded ${money(p.refunded_kobo)}`}
                </p>
              ))
            )}
          </div>
        </>
      )}
      {tab === "invoices" && !invoice && (
        <div className="space-y-3">
          {!invoices.length && <p>No issued invoices.</p>}
          {invoices.map((i) => (
            <button
              className={card + " w-full text-left"}
              key={String(i.id)}
              onClick={() =>
                run(async () => setInvoice(await request("/invoices/" + i.id)))
              }
            >
              <strong>{String(i.invoice_number || i.description)}</strong>
              <p>{String(i.description)}</p>
              <p>
                {money(i.amount_kobo)} · {String(i.display_status)} · Due{" "}
                {String(i.due_on).slice(0, 10)}
              </p>
              <p>Outstanding {money(i.outstanding_kobo)}</p>
            </button>
          ))}
        </div>
      )}
      {tab === "invoices" && invoice && (
        <article className={card}>
          <button className={button} onClick={() => setInvoice(null)}>
            Back to invoices
          </button>
          <h2 className="mt-4 text-2xl font-semibold">
            {String(invoice.invoice_number || invoice.id)}
          </h2>
          <p>JK Technology Limited → {String(invoice.customer_name)}</p>
          <p>{String(invoice.project_name)}</p>
          <p>
            {String(invoice.display_status)} · Due{" "}
            {String(invoice.due_on).slice(0, 10)}
          </p>
          {(invoice.line_items as Row[]).map((item, index) => (
            <p className="py-3" key={index}>
              {String(item.description)} · {String(item.quantity)} ×{" "}
              {money(item.unitKobo)}
            </p>
          ))}
          <p>
            Total {money(invoice.amount_kobo)} · Paid {money(invoice.paid_kobo)}{" "}
            · Outstanding {money(invoice.outstanding_kobo)}
          </p>
          <a
            className="my-4 block underline"
            href={endpoint + "/invoices/" + invoice.id + "/pdf"}
          >
            Download PDF invoice
          </a>
          {(invoice.instalments as Row[]).map((row, index) => (
            <p key={index}>
              Instalment due {String(row.dueOn)}: {money(row.amountKobo)}
            </p>
          ))}
          {invoice.status === "OPEN" && !invoice.payment_review && (
            <form
              className="mt-4 flex flex-wrap gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const f = new FormData(event.currentTarget);
                void run(async () => {
                  const result = await request(
                    "/invoices/" + invoice.id + "/pay",
                    { amountKobo: Math.round(Number(f.get("amount")) * 100) },
                  );
                  const url = new URL(result.url);
                  if (
                    url.protocol !== "https:" ||
                    url.hostname !== "checkout.paystack.com"
                  )
                    throw Error("Payment link unavailable.");
                  window.location.assign(url.toString());
                });
              }}
            >
              <label>
                Payment amount (NGN): next instalment or full balance
                <input
                  className={input}
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(invoice.outstanding_kobo) / 100}
                  defaultValue={Number(invoice.next_payment_kobo) / 100}
                  required
                />
              </label>
              <button className={button} disabled={busy}>
                Pay securely to JKTL
              </button>
            </form>
          )}
          {Boolean(invoice.payment_review) && (
            <p>
              Payment is under review. Contact JKTL support before paying again.
            </p>
          )}
        </article>
      )}
      {tab === "support" && !ticket && (
        <>
          <form
            className={card + " space-y-3"}
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget,
                f = new FormData(form);
              void run(async () => {
                const r = await request("/support", {
                  subject: f.get("subject"),
                  message: f.get("message"),
                  category: f.get("category"),
                });
                form.reset();
                await load();
                await openTicket(r.id);
              });
            }}
          >
            <h2 className="text-xl font-semibold">Contact JKTL support</h2>
            <label className="block">
              Category
              <select name="category" className={input}>
                {Object.entries({
                  BILLING: "Billing / payments",
                  WEBSITE_TECHNICAL: "Website / hosting",
                  WEBSITE_CONTENT: "Content",
                  DOMAIN: "Domain",
                  EMAIL: "Business email",
                  MAINTENANCE: "Maintenance",
                  FEATURE_REQUEST: "Feature request",
                }).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              Subject
              <input
                required
                maxLength={160}
                name="subject"
                className={input}
              />
            </label>
            <label className="block">
              How can we help?
              <textarea
                required
                maxLength={3000}
                name="message"
                className={input}
              />
            </label>
            <p className="text-sm">
              Never include passwords, card details or credentials.
            </p>
            <button disabled={busy} className={button}>
              Open support ticket
            </button>
          </form>
          {cases.map((c) => (
            <button
              key={String(c.id)}
              className={card + " w-full text-left"}
              onClick={() => run(async () => openTicket(c.id))}
            >
              {String(c.subject)} · {String(c.status)}
            </button>
          ))}
        </>
      )}
      {tab === "support" && ticket && (
        <article className={card + " space-y-4"}>
          <button className={button} onClick={() => setTicket(null)}>
            Back to support
          </button>
          <h2 className="text-xl font-semibold">
            {String(ticket.case.subject)}
          </h2>
          <p>{String(ticket.case.status)}</p>
          {ticket.messages.map((m) => (
            <div className="border-t border-current/10 pt-3" key={String(m.id)}>
              <b>{String(m.sender)}</b>
              <p className="whitespace-pre-wrap">{String(m.body)}</p>
            </div>
          ))}
          {attachments.map((file) => (
            <a
              className="block underline"
              key={String(file.id)}
              href={
                endpoint +
                "/support/" +
                ticket.case.id +
                "/attachments/" +
                file.id
              }
            >
              {String(file.file_name)} ({String(file.size)} bytes)
            </a>
          ))}
          {ticket.case.status !== "RESOLVED" && (
            <label className="block">
              Attach PNG, JPEG, WebP or PDF (up to 512 KB)
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void run(async () => {
                    if (file.size > 524288)
                      throw Error("Choose a file up to 512 KB.");
                    const body = await new Promise<string>(
                      (resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () =>
                          resolve(String(reader.result).split(",")[1]);
                        reader.onerror = () =>
                          reject(Error("Could not read file."));
                        reader.readAsDataURL(file);
                      },
                    );
                    await request(
                      "/support/" + ticket.case.id + "/attachments",
                      { name: file.name, body },
                    );
                    await openTicket(ticket.case.id);
                  });
                  event.target.value = "";
                }}
              />
            </label>
          )}
          {ticket.case.status !== "RESOLVED" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget,
                  f = new FormData(form);
                void run(async () => {
                  await request("/support/" + ticket.case.id + "/replies", {
                    message: f.get("message"),
                  });
                  await openTicket(ticket.case.id);
                  form.reset();
                });
              }}
            >
              <label>
                Reply
                <textarea
                  required
                  maxLength={3000}
                  name="message"
                  className={input}
                />
              </label>
              <button disabled={busy} className={button}>
                Send reply
              </button>
            </form>
          )}
        </article>
      )}
      <p className="text-xs opacity-70">
        Billing and support powered by JKTL Business. Your website operates
        independently.
      </p>
    </section>
  );
}
