"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/app/field";
import { JktlWordmark } from "@/components/app/logo";
import { getWebsiteTemplate, templateEditorPath } from "@/lib/website-templates";
import { pendingTemplate, rememberTemplate } from "@/lib/template-selection";
import { useBusinessStore } from "@/lib/store";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const selected = getWebsiteTemplate(params.get("template"));
  const authenticated = useBusinessStore(s => s.authenticated);
  const hydrated = useBusinessStore(s => s.hydrated);
  const mode = useBusinessStore(s => s.mode);
  useEffect(() => {
    if (selected) { rememberTemplate(selected.id); if (hydrated && authenticated && mode === "live") router.replace(templateEditorPath(selected.id)); }
  }, [selected, hydrated, authenticated, mode, router]);
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
    const nextTemplate = pendingTemplate(params.get("template"));
    router.push(nextTemplate ? templateEditorPath(nextTemplate) : "/business");
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <JktlWordmark />
      <h1 className="mt-10 font-display text-2xl font-bold tracking-tight text-ink">Welcome back</h1>
      <p className="mt-1.5 text-sm text-ink-muted">Sign in to run your business today.</p>

      {selected && <div className="mt-5 rounded-xl border border-border bg-surface p-4 text-sm"><strong>{selected.name}</strong><p className="mt-1 text-ink-muted">Your selected template is ready. Sign in to open it in the website editor.</p></div>}

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
        <Link href={selected ? `/signup?template=${selected.id}` : "/signup"} className="font-medium text-primary">
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
            router.push(selected ? templateEditorPath(selected.id) : "/business");
          }}
        >
          Open salon demo
        </Button>
      </div>
    </div>
  );
}

export default function LoginPage(){return <Suspense fallback={<div className="p-6">Loading sign-in…</div>}><LoginForm/></Suspense>;}
