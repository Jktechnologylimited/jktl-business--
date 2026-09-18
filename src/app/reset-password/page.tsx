"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/app/field";
import { JktlWordmark } from "@/components/app/logo";
import { resetPasswordAction } from "@/lib/actions/auth-actions";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError("");
    setPending(true);
    const result = await resetPasswordAction(token, password);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  if (!token) {
    return (
      <div className="mt-10">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Invalid reset link</h1>
        <p className="mt-2 text-sm text-ink-muted">
          This link is missing its reset token. Request a new one from the sign-in page.
        </p>
        <Link href="/forgot-password" className="mt-6 inline-block text-sm font-medium text-primary">
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mt-10">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Password updated</h1>
        <p className="mt-2 text-sm text-ink-muted">You can now sign in with your new password.</p>
        <Button className="mt-6 w-full" size="lg" onClick={() => router.push("/login")}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <>
      <h1 className="mt-10 font-display text-2xl font-bold tracking-tight text-ink">Choose a new password</h1>
      <p className="mt-1.5 text-sm text-ink-muted">Make it at least 6 characters.</p>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <Field label="New password" htmlFor="password">
          <PasswordInput
            id="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoFocus
          />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm">
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
          />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
          {pending ? "Updating…" : "Update password"}
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <JktlWordmark />
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
