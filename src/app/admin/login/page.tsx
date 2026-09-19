"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/app/field";
import { JktlMark } from "@/components/app/logo";
import { adminLoginAction } from "@/lib/actions/admin-actions";

/** Deliberately its own login page, entirely separate from `/login` — a
 * command-center credential is not a business account with extra
 * privileges, it's a different account altogether (see migrations/009). */
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    const result = await adminLoginAction(email, password);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/admin");
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <div className="flex items-center gap-2.5">
        <JktlMark className="size-9" />
        <div>
          <div className="font-display text-base font-bold tracking-tight text-ink">JKTL Business</div>
          <div className="flex items-center gap-1 text-xs font-medium text-ink-muted">
            <ShieldCheck className="size-3.5" /> Command center
          </div>
        </div>
      </div>

      <h1 className="mt-10 font-display text-2xl font-bold tracking-tight text-ink">Admin sign in</h1>
      <p className="mt-1.5 text-sm text-ink-muted">Internal access only — not a business account login.</p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <Field label="Email" htmlFor="admin-email">
          <Input id="admin-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password" htmlFor="admin-password">
          <PasswordInput
            id="admin-password"
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
    </div>
  );
}
