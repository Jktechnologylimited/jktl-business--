"use client";
import { gameReturnUrl } from "@/lib/game-routing";
import { SignInFrame } from "@/components/auth/SignInFrame";
import { LanguageSwitcher, T } from "@/components/i18n/LanguageProvider";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/app/field";
import { JktlWordmark } from "@/components/app/logo";
import {
  getWebsiteTemplate,
  templateEditorPath,
} from "@/lib/website-templates";
import { pendingTemplate, rememberTemplate } from "@/lib/template-selection";
import { useBusinessStore } from "@/lib/store";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const selected = getWebsiteTemplate(params.get("template"));
  const authenticated = useBusinessStore((s) => s.authenticated);
  const hydrated = useBusinessStore((s) => s.hydrated);
  const mode = useBusinessStore((s) => s.mode);
  useEffect(() => {
    if (selected) {
      rememberTemplate(selected.id);
      if (hydrated && authenticated && mode === "live")
        router.replace(templateEditorPath(selected.id));
    }
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
    const returnGame = params.get("next");
    const gameUrl = gameReturnUrl(returnGame); if (gameUrl) { window.location.assign(gameUrl); return; }
    const nextTemplate = pendingTemplate(params.get("template"));
    if (params.get("next") === "tycoon") { router.push("/play/tycoon"); return; }
    router.push(nextTemplate ? templateEditorPath(nextTemplate) : "/business");
  }

  useEffect(() => { if (hydrated && authenticated && mode === "live") { const value=params.get("next"); if(value==="tycoon") router.replace("/play/tycoon"); else { const gameUrl=gameReturnUrl(value); if(gameUrl) window.location.assign(gameUrl); } } }, [params, hydrated, authenticated, mode, router]);

  return (
    <SignInFrame kind="business"><div className="mx-auto flex max-w-sm flex-col justify-center">
      <div className="mb-4 flex justify-end">
        <LanguageSwitcher />
      </div>
      <JktlWordmark />
      <h1 className="mt-10 font-display text-2xl font-bold tracking-tight text-ink">
        <T>Welcome back</T>
      </h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        <T>Sign in to run your business today.</T>
      </p>

      {selected && (
        <div className="mt-5 rounded-xl border border-border bg-surface p-4 text-sm">
          <strong>{selected.name}</strong>
          <p className="mt-1 text-ink-muted">
            <T>
              Your selected template is ready. Sign in to open it in the website
              editor.
            </T>
          </p>
        </div>
      )}

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
        <Button
          type="submit"
          size="lg"
          className="mt-1 w-full"
          disabled={pending}
        >
          <T>{pending ? "Signing in…" : "Sign in"}</T>
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="font-medium text-primary">
          <T>Forgot password?</T>
        </Link>
        <Link
          href={selected ? `/signup?template=${selected.id}` : "/signup"}
          className="font-medium text-primary"
        >
          <T>Create account</T>
        </Link>
      </div>

      <div className="mt-10 rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-ink">
          <T>Glam Hair Studio · Yenagoa</T>
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          <T>Try the app with a real salon&apos;s data — no account needed.</T>
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3 w-full"
          onClick={() => {
            openDemo();
            router.push(
              selected ? templateEditorPath(selected.id) : "/business",
            );
          }}
        >
          <T>Open salon demo</T>
        </Button>
      </div>
    </div></SignInFrame>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <T>Loading sign-in…</T>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
