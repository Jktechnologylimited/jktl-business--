"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
export function ReferralConsent() {
  const params = useSearchParams();
  const code = params.get("ref") || "";
  const [done, setDone] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (done || !/^[a-zA-Z0-9_-]{3,64}$/.test(code)) return null;
  async function decide(consent: boolean) {
    setBusy(true);
    try {
      const r = await fetch("/api/referrals/capture", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          consent ? { code, consent: true } : { decline: true },
        ),
      });
      if (!r.ok) throw Error();
      setDone(true);
    } catch {
      setError(
        "Tracking is unavailable. You can continue signing up without it.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside
      aria-label="Referral tracking choice"
      className="mb-5 rounded-xl border border-border bg-surface p-4 text-ink"
    >
      <strong>Someone introduced you to JKTL.</strong>
      <p className="my-2 text-sm">
        Allow a 30-day referral cookie to credit their introduction if you
        become an eligible customer. Your price does not change. You can
        continue without tracking.{" "}
        <Link className="underline" href="https://jktl.com.ng/privacy">
          Privacy policy
        </Link>
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => decide(true)}
          className="rounded-lg border border-border bg-paper p-2"
        >
          Allow referral credit
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide(false)}
          className="rounded-lg p-2 underline"
        >
          Continue without tracking
        </button>
      </div>
      {error && <p role="status">{error}</p>}
    </aside>
  );
}
