"use client";
import { importLegacyPartnerAction } from "@/lib/actions/legacy-partner-actions";
import { useState } from "react";
import { approvePartnerAction } from "@/lib/actions/partner-actions";
import {
  setAffiliateStatusAction,
  rejectAffiliateApplicationAction,
} from "@/lib/actions/admin-actions";
import styles from "@/components/domains/domains.module.css";
type Row = Record<string, unknown>;
export function PartnerManager({
  initial,
  legacy,
}: {
  initial: Row[];
  legacy?: { configured: boolean; available: boolean; applications: Row[] };
}) {
  const [rows, setRows] = useState(initial),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function run(
    id: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
    status: string,
    updates: Row = {},
  ) {
    setBusy(true);
    try {
      const r = await fn();
      setMessage(r.ok ? "Partner updated." : r.error || "Could not update.");
      if (r.ok)
        setRows(
          rows.map((p) => (p.id === id ? { ...p, status, ...updates } : p)),
        );
    } catch {
      setMessage("Could not update. Check your session.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <p>JKTL ADMIN / PARTNERS</p>
        <h1>
          Trusted relationships.
          <br />
          Clear agreements.
        </h1>
        <p>
          Review applications and record negotiated terms before approving
          access. Partner accounts use the existing programme authentication and
          commission ledger.
        </p>
      </header>
      <div className={styles.body}>
        {message && <p role="status">{message}</p>}
        {legacy && (
          <section className={styles.section}>
            <h2>Earlier Main-site applications</h2>
            {!legacy.configured ? (
              <p>
                Configure the private partner bridge in both deployments to
                review older Main-site enquiries here. New portal applications
                appear below automatically.
              </p>
            ) : !legacy.available ? (
              <p>
                The Main inquiry source is temporarily unavailable. Current
                portal applications remain available below.
              </p>
            ) : (
              legacy.applications.map((a) => (
                <article className={styles.request} key={String(a.id)}>
                  <h3>{String(a.name)}</h3>
                  <p>
                    {String(a.email)} · {String(a.business_name || "")}
                  </p>
                  <p>{String(a.message || "")}</p>
                  <button
                    disabled={
                      busy ||
                      rows.some(
                        (r) =>
                          String(r.email).toLowerCase() ===
                          String(a.email).toLowerCase(),
                      )
                    }
                    onClick={async () => {
                      setBusy(true);
                      const result = await importLegacyPartnerAction(
                        String(a.id),
                      );
                      setMessage(
                        result.ok
                          ? "Imported as pending. Reload to review the account and agree terms."
                          : result.error || "Could not import.",
                      );
                      setBusy(false);
                      if (result.ok) window.location.reload();
                    }}
                  >
                    Import for approval
                  </button>
                </article>
              ))
            )}
          </section>
        )}
        {!rows.length && <p>No partner applications yet.</p>}
        {rows
          .filter((p) => p.status !== "rejected")
          .map((p) => (
            <article key={String(p.id)} className={styles.section}>
              <h2>{String(p.name)}</h2>
              <p>
                {String(p.email)} · {String(p.status)}
              </p>
              <p style={{ whiteSpace: "pre-wrap" }}>
                {String(p.application_note)}
              </p>
              <p>Agreed rate: {Number(p.commission_bps) / 100}%</p>
              {Boolean(p.partner_agreement) && (
                <p style={{ whiteSpace: "pre-wrap" }}>
                  Agreement: {String(p.partner_agreement)}
                </p>
              )}
              {p.status === "pending" ? (
                <form
                  className={styles.form}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const d = new FormData(e.currentTarget);
                    run(
                      String(p.id),
                      () =>
                        approvePartnerAction(
                          String(p.id),
                          Number(d.get("bps")),
                          String(d.get("agreement")),
                        ),
                      "active",
                      {
                        commission_bps: Number(d.get("bps")),
                        partner_agreement: String(d.get("agreement")),
                      },
                    );
                  }}
                >
                  <label>
                    Agreed commission (basis points: 100 = 1%)
                    <input
                      name="bps"
                      type="number"
                      min={0}
                      max={10000}
                      required
                    />
                  </label>
                  <label>
                    Written agreement / qualifying purchase terms
                    <textarea
                      name="agreement"
                      minLength={20}
                      maxLength={3000}
                      required
                    />
                  </label>
                  <button disabled={busy}>Approve partner</button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(
                        String(p.id),
                        () => rejectAffiliateApplicationAction(String(p.id)),
                        "rejected",
                      )
                    }
                  >
                    Decline application
                  </button>
                </form>
              ) : (
                <button
                  disabled={busy}
                  onClick={() =>
                    run(
                      String(p.id),
                      () =>
                        setAffiliateStatusAction(
                          String(p.id),
                          p.status === "active" ? "suspended" : "active",
                        ),
                      p.status === "active" ? "suspended" : "active",
                    )
                  }
                >
                  {p.status === "active" ? "Suspend" : "Reactivate"}
                </button>
              )}
            </article>
          ))}
      </div>
    </section>
  );
}
