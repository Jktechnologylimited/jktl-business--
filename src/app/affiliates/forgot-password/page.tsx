"use client";

import { useState } from "react";
import Link from "next/link";
import { Handshake, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { JktlMark } from "@/components/app/logo";
import { requestAffiliatePasswordResetAction } from "@/lib/actions/affiliate-actions";

/**
 * Forgot password.
 *
 * The confirmation message is deliberately identical whether or not the address
 * belongs to a partner — an endpoint that says "no account with that email" is an
 * account-enumeration oracle, and on a partner programme the email list is the
 * sales pipeline. The only message that differs is the rate limit, which has to
 * be visible or the form would appear to work while silently dropping requests.
 */
export default function AffiliateForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const result = await requestAffiliatePasswordResetAction(email);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.data.message);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <div className="flex items-center gap-2.5">
        <JktlMark className="size-9" />
        <div>
          <div className="font-display text-base font-bold tracking-tight text-ink">JKTL Business</div>
          <div className="flex items-center gap-1 text-xs font-medium text-ink-muted">
            <Handshake className="size-3.5" /> Affiliate portal
          </div>
        </div>
      </div>

      <h1 className="mt-10 font-display text-2xl font-bold tracking-tight text-ink">Reset your password</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Enter the email you applied with and we&apos;ll send you a link to set a new password.
      </p>

      {message ? (
        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm text-ink">{message}</p>
            <p className="mt-1 text-xs text-ink-muted">The link works for 30 minutes, and only once.</p>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
          <Field label="Email" htmlFor="aff-forgot-email">
            <Input
              id="aff-forgot-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-xs text-ink-muted">
        Remembered it?{" "}
        <Link href="/affiliates/login" className="font-medium text-primary">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
