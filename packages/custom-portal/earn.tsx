"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
type Profile = {
  program: string;
  name: string;
  status: string;
  stage: string;
  reviewMessage: string;
  ready: boolean;
  referralUrl: string | null;
  signups: number;
  pendingKobo: number;
  availableKobo: number;
  paidKobo: number;
};
type EarnData = {
  profiles: Profile[];
  canApplyPartner: boolean;
  needsLink: boolean;
};
const money = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
    n / 100,
  );
export function ProjectEarn({ endpoint }: { endpoint: string }) {
  const [data, setData] = useState<EarnData | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const request = useCallback(
    async (path: string, body?: unknown) => {
      const response = await fetch(endpoint + "/earn" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(
          result.error ||
            "Earn is unavailable. Ask JKTL to enable your owner integration.",
        );
      return result.data;
    },
    [endpoint],
  );
  const load = useCallback(async () => setData(await request("")), [request]);
  useEffect(() => {
    let active = true;
    void request("")
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, [request]);
  async function submit(event: FormEvent<HTMLFormElement>, path: string) {
    event.preventDefault();
    const form = event.currentTarget,
      fields = new FormData(form),
      body = Object.fromEntries(fields);
    setBusy(true);
    setMessage("");
    try {
      await request(
        path,
        path === "/apply"
          ? { ...body, consent: fields.get("consent") === "on" }
          : body,
      );
      form.reset();
      await load();
      setMessage(
        path === "/apply"
          ? "Application received. JKTL will review it and agree your referral terms before you start earning."
          : "Your programme account is connected.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please retry.");
    } finally {
      const password = form.elements.namedItem("password");
      if (password instanceof HTMLInputElement) password.value = "";
      setBusy(false);
    }
  }
  const card = "rounded-2xl border border-current/15 bg-white/5 p-5",
    button =
      "rounded-lg border border-current/25 px-4 py-2 font-semibold disabled:opacity-50",
    input =
      "mt-1 w-full rounded-lg border border-current/20 bg-transparent p-3";
  return (
    <section className="space-y-6" aria-label="Earn with JKTL">
      <header>
        <p className="text-sm font-semibold uppercase tracking-widest">
          JKTL Partners
        </p>
        <h2 className="mt-2 text-2xl font-semibold">
          Recommend JKTL. Earn from qualifying referrals.
        </h2>
        <p className="mt-3">
          Introduce business owners to JKTL websites, domains and business
          email. Apply as a partner, agree your terms, then share your personal
          referral link.
        </p>
        <p className="mt-2 text-sm">
          Your programme account is shared across your custom projects.
          Commissions depend on approved terms and verified qualifying payments;
          refunds and eligibility checks can affect earnings.
        </p>
      </header>
      {message && (
        <p role="status" className={card}>
          {message}
        </p>
      )}
      <button
        type="button"
        className={button}
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void load()
            .catch((e) => setMessage(e.message))
            .finally(() => setBusy(false));
        }}
      >
        Refresh Earn
      </button>
      {!data && !message && <p role="status">Loading your referral account…</p>}
      {data?.profiles.map((p) => (
        <article className={card + " space-y-4"} key={p.program}>
          <h3 className="text-xl font-semibold">
            {p.program === "partner" ? "JKTL Partner" : "JKTL Affiliate"} ·{" "}
            {p.name}
          </h3>
          <p>Status: {p.ready ? "Ready to share" : p.stage || p.status}</p>
          {p.reviewMessage && <p>{p.reviewMessage}</p>}
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Referred signups", p.signups],
              ["Pending", money(p.pendingKobo)],
              ["Available", money(p.availableKobo)],
              ["Paid out", money(p.paidKobo)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm">{label}</dt>
                <dd className="mt-1 text-lg font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          {p.ready && p.referralUrl ? (
            <div>
              <label className="block">
                Your referral link
                <input
                  readOnly
                  value={p.referralUrl}
                  className={input}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </label>
              <button
                type="button"
                className={button + " mt-3"}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(p.referralUrl!);
                    setMessage("Referral link copied.");
                  } catch {
                    setMessage("Select and copy your referral link above.");
                  }
                }}
              >
                Copy referral link
              </button>
              <a
                className="ml-4 text-blue-600 underline"
                target="_blank"
                rel="noopener noreferrer"
                href={
                  "https://wa.me/?text=" +
                  encodeURIComponent(
                    "Build your business online with JKTL: " +
                      p.referralUrl +
                      " — I may earn a commission from qualifying purchases through my link.",
                  )
                }
              >
                Share on WhatsApp
              </a>
              <p className="mt-3 text-sm">
                Disclose that you may earn a commission when sharing your link.
                Self-referrals and unqualified purchases do not earn
                commissions.
              </p>
            </div>
          ) : (
            <p>
              Your link becomes available when your account and referral terms
              are active. Contact JKTL if your application needs attention.
            </p>
          )}
          <p className="text-sm">
            Use your{" "}
            <a
              className="text-blue-600 underline"
              href="https://business.jktl.com.ng/business/distribution"
              target="_blank"
              rel="noopener noreferrer"
            >
              JKTL Business programme dashboard
            </a>{" "}
            for agreement details, payout setup and support. Existing payout
            controls still apply.
          </p>
        </article>
      ))}
      {data?.needsLink && (
        <p className={card}>
          An existing programme account matches your Business account. Connect
          it below using that programme account’s credentials. Matching email
          alone does not grant access.
        </p>
      )}
      {data?.canApplyPartner && (
        <form
          className={card + " space-y-4"}
          onSubmit={(e) => submit(e, "/apply")}
        >
          <h3 className="text-xl font-semibold">Apply to JKTL Partners</h3>
          <p>
            Keep your current website login. No separate password is needed for
            a new application.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["company", "Business / company name"],
              ["phone", "Phone number"],
              ["country", "Country"],
              ["category", "Your business category"],
            ].map(([name, label]) => (
              <label key={name}>
                {label}
                <input
                  className={input}
                  name={name}
                  required
                  maxLength={200}
                  defaultValue={name === "country" ? "Nigeria" : undefined}
                />
              </label>
            ))}
          </div>
          <label className="block">
            How will you recommend JKTL?
            <textarea
              className={input}
              name="partnership"
              required
              maxLength={2000}
            />
          </label>
          <label className="block">
            Services you offer (optional)
            <input className={input} name="services" maxLength={2000} />
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" name="consent" required className="mt-1" />
            <span>
              I agree to submit this partner application under the{" "}
              <a
                href="https://jktl.com.ng/partners"
                className="text-blue-600 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                current JKTL Partners terms
              </a>{" "}
              and{" "}
              <a
                href="https://jktl.com.ng/privacy"
                className="text-blue-600 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </a>
              . I understand approval and an agreed commission arrangement are
              required before earning.
            </span>
          </label>
          <button disabled={busy} className={button}>
            Submit partner application
          </button>
        </form>
      )}
      {data && (
        <details className={card}>
          <summary className="cursor-pointer font-semibold">
            Already a JKTL Affiliate or Partner? Connect your account
          </summary>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => submit(e, "/connect")}
          >
            <label className="block">
              Programme
              <select name="program" className={input}>
                <option value="partner">JKTL Partners</option>
                <option value="affiliate">JKTL Affiliates</option>
              </select>
            </label>
            <label className="block">
              Programme email
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                className={input}
              />
            </label>
            <label className="block">
              Programme password
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                className={input}
              />
            </label>
            <button className={button} disabled={busy}>
              Connect existing account
            </button>
          </form>
        </details>
      )}
    </section>
  );
}
