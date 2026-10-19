"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Handshake, Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/app/field";
import { JktlMark } from "@/components/app/logo";
import {
  resetAffiliatePasswordAction,
  checkAffiliateResetTokenAction,
} from "@/lib/actions/affiliate-actions";

/**
 * Set a new password.
 *
 * The token is checked **before** the form is shown, so an expired or already-used
 * link says so immediately rather than after somebody has typed a password twice —
 * and the two cases say different things, because a partner who clicked twice
 * needs "already used" to make sense rather than "invalid".
 */
/**
 * `useSearchParams` suspends, so the page has to be wrapped — without this the
 * build fails outright with "useSearchParams() should be wrapped in a suspense
 * boundary", which is exactly what happened when this was first added.
 */
export default function AffiliateResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // Both derive from the token during render rather than being set from inside
  // the effect: a synchronous setState in an effect body costs a second render
  // and, more practically, is a class of bug the lint rule is right to flag.
  const [error, setError] = useState(() => (token ? "" : "This link is missing its reset code. Request a new one."));
  const [done, setDone] = useState("");
  const [pending, setPending] = useState(false);
  const [checking, setChecking] = useState(Boolean(token));
  const [who, setWho] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      const result = await checkAffiliateResetTokenAction(token);
      if (cancelled) return;
      setChecking(false);
      if (result.ok) setWho(result.data);
      else setError(result.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    const result = await resetAffiliatePasswordAction({ token, password, confirm });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(result.data.message);
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

      <h1 className="mt-10 font-display text-2xl font-bold tracking-tight text-ink">Set a new password</h1>

      {checking ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-ink-muted">
          <Loader2 className="size-4 animate-spin" /> Checking your link…
        </p>
      ) : done ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm text-ink">{done}</p>
            <Link href="/affiliates/login" className={`${buttonVariants()} mt-3`}>
              Go to sign in
            </Link>
          </div>
        </div>
      ) : error && !who ? (
        <div className="mt-6">
          <p className="rounded-2xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-ink">{error}</p>
          <p className="mt-4 text-xs text-ink-muted">
            <Link href="/affiliates/forgot-password" className="font-medium text-primary">
              Request a new reset link
            </Link>
          </p>
        </div>
      ) : (
        <>
          {who ? (
            <p className="mt-1.5 text-sm text-ink-muted">
              Setting a new password for <span className="font-medium text-ink">{who.email}</span>.
            </p>
          ) : null}
          <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
            <Field label="New password" htmlFor="aff-reset-password">
              <PasswordInput
                id="aff-reset-password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            <Field label="Confirm new password" htmlFor="aff-reset-confirm">
              <PasswordInput
                id="aff-reset-confirm"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </Field>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
              {pending ? "Saving…" : "Set new password"}
            </Button>
            <p className="text-xs text-ink-muted">
              At least 6 characters. Every other device you were signed in on will be signed out.
            </p>
          </form>
        </>
      )}
    </div>
  );
}
