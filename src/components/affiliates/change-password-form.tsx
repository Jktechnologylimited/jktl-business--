"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/app/field";
import { useToastStore } from "@/lib/toast";
import { changeAffiliatePasswordAction } from "@/lib/actions/affiliate-actions";

/** Simple inline form (not a modal) — an affiliate's dashboard is a single
 * page, unlike the business Settings screen this mirrors, so there's no
 * sheet to put it in. Collapsed behind a toggle since most visits to this
 * page are just checking the referral link and balance. */
export function ChangePasswordForm() {
  const showToast = useToastStore((s) => s.show);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (next !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError("");
    setPending(true);
    const result = await changeAffiliatePasswordAction(current, next);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setOpen(false);
    showToast("Password updated");
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-start text-sm font-medium text-primary">
        Change password
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-border p-4">
      <Field label="Current password" htmlFor="aff-pw-current">
        <PasswordInput id="aff-pw-current" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoFocus />
      </Field>
      <Field label="New password" htmlFor="aff-pw-next">
        <PasswordInput id="aff-pw-next" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
      </Field>
      <Field label="Confirm new password" htmlFor="aff-pw-confirm">
        <PasswordInput id="aff-pw-confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? "Updating…" : "Update password"}
        </Button>
      </div>
    </form>
  );
}
