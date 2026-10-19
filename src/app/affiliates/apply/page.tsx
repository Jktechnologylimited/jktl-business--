"use client";

import { useState } from "react";
import Link from "next/link";
import { Handshake, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/app/field";
import { JktlMark } from "@/components/app/logo";
import { applyAsAffiliateAction } from "@/lib/actions/affiliate-actions";

/**
 * Public self-serve application (migration 014) — the other half of the
 * command-center-approves flow. Submitting this lands the applicant in
 * `status = 'pending'`; they set their own password here, so approving
 * later (Admin → Affiliates) is just a status flip, nothing to generate or
 * share with them separately.
 */
export default function AffiliateApplyPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError("");
    setPending(true);
    const result = await applyAsAffiliateAction({ name, email, password, applicationNote: note });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10 text-center">
        <CheckCircle2 className="mx-auto size-12 text-primary" />
        <h1 className="mt-5 font-display text-xl font-bold tracking-tight text-ink">Application sent</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Applications are reviewed by hand, usually within 24–48 hours. We&apos;ll email you the moment you&apos;re
          approved.
        </p>
        {/*
          The address is spelled out because it is the thing an approved partner
          needs and is most likely to ask for — "where do I sign in?" — and
          because `applying` and `signing in` are two different pages that look
          identical to somebody who has only seen one of them.
        */}
        <p className="mt-4 text-xs text-ink-muted">
          Then sign in at <span className="font-medium text-ink">business.jktl.com.ng/affiliates/login</span> with the
          email and password you just set, and your referral link will be waiting.
        </p>
        <Link href="/affiliates/login" className="mt-5 text-sm font-medium text-primary">
          Go to sign in
        </Link>
      </div>
    );
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

      <h1 className="mt-10 font-display text-2xl font-bold tracking-tight text-ink">Become an affiliate</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Earn a recurring commission every time a business you refer stays subscribed. Apply below — a real person
        reviews every application before it goes live.
      </p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <Field label="Full name" htmlFor="apply-name">
          <Input id="apply-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </Field>
        <Field label="Email" htmlFor="apply-email">
          <Input id="apply-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password" htmlFor="apply-password" hint="At least 6 characters — you'll use this to sign in once approved.">
          <PasswordInput id="apply-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </Field>
        <Field label="Confirm password" htmlFor="apply-confirm">
          <PasswordInput id="apply-confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
        </Field>
        <Field label="How do you plan to promote JKTL Business?" htmlFor="apply-note" hint="Your social handles, audience, or how you found us — optional, but it helps us review faster.">
          <Textarea id="apply-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. @yourhandle on TikTok, 5k followers, small-business content" />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
          {pending ? "Submitting…" : "Submit application"}
        </Button>
      </form>
      <p className="mt-6 text-center text-xs text-ink-muted">
        Already applied, or already a partner?{" "}
        <Link href="/affiliates/login" className="font-medium text-primary">
          Sign in at business.jktl.com.ng/affiliates/login
        </Link>
      </p>
    </div>
  );
}
