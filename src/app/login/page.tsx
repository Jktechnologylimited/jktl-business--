"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/app/field";
import { JktlWordmark } from "@/components/app/logo";
import { useBusinessStore } from "@/lib/store";

export default function LoginPage() {
  const router = useRouter();
  const login = useBusinessStore((s) => s.login);
  const openDemo = useBusinessStore((s) => s.openDemo);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    const result = await login(email, password);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/business");
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <JktlWordmark />
      <h1 className="mt-10 font-display text-2xl font-bold tracking-tight text-ink">Welcome back</h1>
      <p className="mt-1.5 text-sm text-ink-muted">Sign in to run your business today.</p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourbusiness.com"
            required
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <PasswordInput
            id="password"
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
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="font-medium text-primary">
          Forgot password?
        </Link>
        <Link href="/signup" className="font-medium text-primary">
          Create account
        </Link>
      </div>

      <div className="mt-10 rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-ink">Glam Hair Studio · Yenagoa</p>
        <p className="mt-1 text-xs text-ink-muted">
          Try the app with a real salon&apos;s data — no account needed.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3 w-full"
          onClick={() => {
            openDemo();
            router.push("/business");
          }}
        >
          Open salon demo
        </Button>
      </div>
    </div>
  );
}
