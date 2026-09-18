"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { JktlWordmark } from "@/components/app/logo";
import { requestPasswordResetAction } from "@/lib/actions/auth-actions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    await requestPasswordResetAction(email);
    setPending(false);
    setSent(true);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <JktlWordmark />
      {sent ? (
        <div className="mt-10">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Check your email</h1>
          <p className="mt-2 text-sm text-ink-muted">
            If an account exists for <span className="font-medium text-ink">{email}</span>, a reset link is on its
            way. It works for 1 hour.
          </p>
          <Link href="/login" className="mt-6 inline-block text-sm font-medium text-primary">
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <h1 className="mt-10 font-display text-2xl font-bold tracking-tight text-ink">Reset your password</h1>
          <p className="mt-1.5 text-sm text-ink-muted">We&apos;ll send a reset link to your email.</p>
          <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
              {pending ? "Sending…" : "Send reset link"}
            </Button>
          </form>
          <Link href="/login" className="mt-6 inline-block text-center text-sm font-medium text-primary">
            Back to sign in
          </Link>
        </>
      )}
    </div>
  );
}
