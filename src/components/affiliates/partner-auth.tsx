"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignInFrame } from "@/components/auth/SignInFrame";
import {
  applyPartnerAction,
  partnerLoginAction,
} from "@/lib/actions/partner-actions";
import styles from "@/components/domains/domains.module.css";
export function PartnerAuth({ apply = false }: { apply?: boolean }) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  const router = useRouter();
  return (
    <SignInFrame kind="affiliate">
      <div className={styles.page} style={{ minHeight: 0 }}>
        <p className="text-xs uppercase tracking-widest text-ink-muted">
          JKTL Partners
        </p>
        <h1 className="my-5 text-3xl font-semibold">
          {apply ? "Turn trust into opportunity." : "Welcome back, partner."}
        </h1>
        <p className="mb-6 text-sm text-ink-muted">
          {apply
            ? "Create your programme account. JKTL reviews your application and agrees commission terms before activation."
            : "Sign in to your approved partner account to track referrals and qualifying earnings."}
        </p>
        {message && (
          <p role="status" className={styles.notice}>
            {message}
          </p>
        )}
        {!done && (
          <form
            className={styles.form}
            onSubmit={async (e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              setBusy(true);
              const result = apply
                ? await applyPartnerAction({
                    name: String(d.get("name")),
                    email: String(d.get("email")),
                    password: String(d.get("password")),
                    company: String(d.get("company")),
                    specialism: String(d.get("specialism")),
                    clients: Number(d.get("clients")),
                    message: String(d.get("message")),
                    consent: d.get("consent") === "on",
                  })
                : await partnerLoginAction(
                    String(d.get("email")),
                    String(d.get("password")),
                  );
              setBusy(false);
              if (!result.ok) setMessage(result.error || "Please retry.");
              else if (apply) {
                setDone(true);
                setMessage(
                  "Application received. JKTL will review it and notify you after approval. Your account has not been activated yet.",
                );
              } else router.push("/partners");
            }}
          >
            {apply && (
              <>
                <label>
                  Full name
                  <input name="name" required maxLength={120} />
                </label>
                <label>
                  Company
                  <input name="company" required maxLength={180} />
                </label>
                <label>
                  Specialism
                  <select name="specialism">
                    {[
                      "Website developer",
                      "Digital marketing agency",
                      "Business consultant",
                      "CAC registration agent",
                      "Other business professional",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Clients per month
                  <input
                    name="clients"
                    type="number"
                    min={1}
                    max={10000}
                    required
                  />
                </label>
              </>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                maxLength={254}
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                required
                minLength={apply ? 12 : 1}
                maxLength={128}
                autoComplete={apply ? "new-password" : "current-password"}
              />
            </label>
            {apply && (
              <>
                <label>
                  How do you support business owners?
                  <textarea name="message" required maxLength={2000} />
                </label>
                <label className={styles.consent}>
                  <input name="consent" type="checkbox" required />I agree to
                  application review and a separate partner agreement before
                  earning qualifying commissions.
                </label>
              </>
            )}
            <button disabled={busy}>
              {busy
                ? "Please wait…"
                : apply
                  ? "Apply to JKTL Partners"
                  : "Sign in"}
            </button>
          </form>
        )}
        <div className="mt-6 flex flex-wrap gap-5 text-sm">
          <Link href={apply ? "/partners/login" : "/partners/apply"}>
            {apply ? "Partner sign in" : "Apply as a partner"}
          </Link>
          <Link href="/affiliates/forgot-password">Reset password</Link>
          <Link href="/affiliates/login">Affiliate sign in</Link>
        </div>
      </div>
    </SignInFrame>
  );
}
