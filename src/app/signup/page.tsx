"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/app/field";
import { JktlWordmark } from "@/components/app/logo";
import { useBusinessStore } from "@/lib/store";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startSignup = useBusinessStore((s) => s.startSignup);
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // From an affiliate's referral link (?ref=CODE) — carried through to
  // signupAction once the account is actually created in onboarding (see
  // createLiveAccount in src/lib/store.ts). A missing or invalid code is
  // silently ignored server-side, so this never blocks signup.
  const referralCode = searchParams.get("ref");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startSignup(name, email, password, businessName, referralCode);
    router.push("/onboarding");
  }

  return (
    <>
      <h1 className="mt-10 font-display text-2xl font-bold tracking-tight text-ink">Create your account</h1>
      <p className="mt-1.5 text-sm text-ink-muted">Takes about two minutes. No card required.</p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <Field label="Your name" htmlFor="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Briggs" required />
        </Field>
        <Field label="Business name" htmlFor="businessName">
          <Input
            id="businessName"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Glam Hair Studio"
            required
          />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password" htmlFor="password">
          <PasswordInput id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </Field>
        <Button type="submit" size="lg" className="mt-1 w-full">
          Continue
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary">
          Sign in
        </Link>
      </p>
    </>
  );
}

export default function SignupPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <JktlWordmark />
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </div>
  );
}
