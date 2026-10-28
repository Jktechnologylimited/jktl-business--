"use client";
import { PartnerDomainOrder } from "@/components/domains/partner-domain-order";
import { useEffect, useState } from "react";
import {
  partnerProductStatusAction,
  partnerDomainAvailabilityAction,
  partnerNativeServiceRequestAction,
} from "@/lib/actions/partner-product-actions";
export function ClientServices({ id }: { id: string }) {
  const [data, setData] = useState<Awaited<
      ReturnType<typeof partnerProductStatusAction>
    > | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void partnerProductStatusAction(id)
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active)
          setError(
            "Service details require the owner’s current View services permission.",
          );
      });
    return () => {
      active = false;
    };
  }, [id]);
  if (!data)
    return <p className="text-sm">{error || "Loading authorized services…"}</p>;
  async function request(f: FormData) {
    setBusy(true);
    setError("");
    try {
      await partnerNativeServiceRequestAction({
        workspaceId: id,
        product: String(f.get("product")) as "domains" | "business-email",
        serviceId: String(f.get("service")),
        kind: String(f.get("kind")),
        message: String(f.get("message")),
      });
      setMessage(
        "Request submitted to JKTL’s service team. No service has been changed or charged.",
      );
      setData(await partnerProductStatusAction(id));
    } catch (e) {
      setError(
        e instanceof Error &&
          /^(Current|Choose|Describe|This service|This product|The owner)/.test(
            e.message,
          )
          ? e.message
          : "Unable to submit. Check client permissions and current product access.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-5 rounded-xl border border-border p-5">
      <h2 className="text-xl font-semibold">Client products & provisioning</h2>
      <PartnerDomainOrder
        workspaceId={id}
        prices={data.prices}
        assets={data.domains}
      />
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <article>
          <h3 className="font-semibold">Registered domains</h3>
          {data.domains.map((d) => (
            <p key={String(d.id)} className="my-2">
              {String(d.domain)} · expires {String(d.expires_at).slice(0, 10)}
            </p>
          ))}
          {!data.domains.length && (
            <p className="text-sm text-ink-muted">
              No visible registered domains.
            </p>
          )}
        </article>
        <article>
          <h3 className="font-semibold">Business Email services</h3>
          {data.email.map((e) => (
            <p key={String(e.id)} className="my-2">
              {String(e.domain)} · {String(e.plan_name)} · {String(e.status)} ·
              renewal {String(e.renews_at || "Pending").slice(0, 10)}
            </p>
          ))}
        </article>
      </div>
      <details>
        <summary className="font-semibold">Search domain availability</summary>
        <form
          className="mt-3 flex flex-wrap gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            try {
              const r = await partnerDomainAvailabilityAction(
                id,
                String(f.get("domain")),
                String(f.get("extension")),
              );
              setMessage(
                r.check.status === "AVAILABLE"
                  ? "Availability confirmed. Registration still requires the authorized billing party’s approval and payment."
                  : r.check.status === "UNAVAILABLE"
                    ? "This domain is unavailable."
                    : "Checking availability. Confirmation is pending.",
              );
            } catch {
              setError(
                "Availability could not be confirmed. Check the domain and current client permissions.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            aria-label="Desired domain"
            name="domain"
            required
            placeholder="yourbusiness"
            maxLength={253}
            className="rounded border border-border bg-paper p-3"
          />
          <select
            aria-label="Domain extension"
            name="extension"
            className="rounded border border-border bg-paper p-3"
          >
            {data.prices.map((p) => (
              <option key={String(p.extension)} value={String(p.extension)}>
                {String(p.extension)} · ₦
                {(Number(p.registration_price) / 100).toLocaleString("en-NG")}
              </option>
            ))}
          </select>
          <button disabled={busy} className="rounded border border-border p-3">
            Check availability
          </button>
        </form>
      </details>
      <details>
        <summary className="font-semibold">
          Current Business Email plans
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {data.plans.map((p) => (
            <article
              key={String(p.id)}
              className="rounded border border-border p-3"
            >
              <strong>{String(p.name)}</strong>
              <p>
                {p.price_kobo
                  ? "₦" +
                    (Number(p.price_kobo) / 100).toLocaleString("en-NG") +
                    " / " +
                    String(p.period_months) +
                    " months"
                  : "Request a quote"}
              </p>
              <p>
                {String(p.mailbox_limit)} mailboxes · {String(p.storage_gb)} GB
                each
              </p>
              <p className="text-sm">
                {p.checkout_available
                  ? "Owner-approved ordering available through Business Email."
                  : "Setup enquiry; paid ordering is not currently enabled for this plan."}
              </p>
            </article>
          ))}
        </div>
        <p className="my-3 text-sm">
          For a new service, use the authorized client service request and state
          the plan, domain and preferred mailbox addresses. JKTL reviews
          licensing, ownership and the correct billing party before
          payment/provisioning. Existing services can be managed below without
          sharing mailbox content or passwords.
        </p>
      </details>
      {[
        [
          "domains",
          "Domain change request",
          data.domains,
          ["DNS", "NAMESERVERS", "SUPPORT"],
        ],
        [
          "business-email",
          "Email service request",
          data.email,
          [
            "ADD_MAILBOX",
            "REMOVE_MAILBOX",
            "ALIAS",
            "UPGRADE",
            "MIGRATION",
            "SUPPORT",
          ],
        ],
      ].map(
        ([product, label, services, kinds]) =>
          (services as Record<string, unknown>[]).length > 0 && (
            <form
              key={String(product)}
              className="space-y-3 rounded border border-border p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void request(new FormData(e.currentTarget));
              }}
            >
              <h3 className="font-semibold">{String(label)}</h3>
              <input type="hidden" name="product" value={String(product)} />
              <label>
                Service
                <select
                  name="service"
                  className="ml-2 rounded border border-border bg-paper p-2"
                >
                  {(services as Record<string, unknown>[]).map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>
                      {String(s.domain)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                Request type
                <select
                  name="kind"
                  className="ml-2 rounded border border-border bg-paper p-2"
                >
                  {(kinds as string[]).map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
              <label>
                Requested work
                <textarea
                  name="message"
                  required
                  minLength={10}
                  maxLength={2000}
                  className="block w-full rounded border border-border bg-paper p-3"
                />
              </label>
              <button
                disabled={busy}
                className="rounded border border-border p-3"
              >
                Submit to existing JKTL service workflow
              </button>
            </form>
          ),
      )}
      <div>
        <h3 className="font-semibold">Orders & tasks</h3>
        {[
          ...data.domainOrders,
          ...data.emailOrders,
          ...data.domainTasks,
          ...data.emailRequests,
          ...data.subscriptions,
        ].map((r, i) => (
          <p key={i} className="my-2 text-sm">
            {String(
              r.domain || r.plan_name || r.plan_id || r.kind || "Service",
            )}{" "}
            · {String(r.status)}
          </p>
        ))}
      </div>
    </section>
  );
}
