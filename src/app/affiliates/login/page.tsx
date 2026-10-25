"use client";
import { SignInFrame } from "@/components/auth/SignInFrame";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/app/field";
import { JktlMark } from "@/components/app/logo";
import { affiliateLoginAction } from "@/lib/actions/affiliate-actions";

/** Its own login page, entirely separate from both `/login` (business) and
 * `/admin/login` (command center) — a third, distinct credential. See
 * migrations/012_affiliates.sql. */
export default function AffiliateLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    const result = await affiliateLoginAction(email, password);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/affiliates");
  }

  return (
    <SignInFrame kind="affiliate"><div className="mx-auto flex max-w-sm flex-col justify-center">
      <div className="flex items-center gap-2.5">
        <JktlMark className="size-9" />
        <div>
          <div className="font-display text-base font-bold tracking-tight text-ink">JKTL Business</div>
          <div className="flex items-center gap-1 text-xs font-medium text-ink-muted">
            <Handshake className="size-3.5" /> Affiliate portal
          </div>
        </div>
      </div>

      <h1 className="mt-10 font-display text-2xl font-bold tracking-tight text-ink">Affiliate sign in</h1>
      <p className="mt-1.5 text-sm text-ink-muted">Track your referrals and earnings.</p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <Field label="Email" htmlFor="aff-login-email">
          <Input id="aff-login-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password" htmlFor="aff-login-password">
          <PasswordInput
            id="aff-login-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <Link href="/affiliates/forgot-password" className="-mt-1 self-end text-xs font-medium text-primary">
          Forgot your password?
        </Link>
      </form>
      <p className="mt-6 text-center text-xs text-ink-muted">
        Don&apos;t have an affiliate account?{" "}
        <Link href="/affiliates/apply" className="font-medium text-primary">
          Apply here
        </Link>
      </p>
    </div></SignInFrame>
  );
}
