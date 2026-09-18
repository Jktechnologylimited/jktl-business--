"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/app/field";
import { useBusinessStore } from "@/lib/store";
import { changePasswordAction } from "@/lib/actions/auth-actions";

export function PasswordForm({ onSubmit, onCancel }: { onSubmit: () => void; onCancel: () => void }) {
  const mode = useBusinessStore((s) => s.mode);
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

    if (mode !== "live") {
      // Demo mode has no real account to change — keep the flow usable to try out.
      onSubmit();
      return;
    }

    setPending(true);
    const result = await changePasswordAction(current, next);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSubmit();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {mode !== "live" ? (
        <p className="text-xs text-ink-muted">You&apos;re in demo mode — this won&apos;t change a real account.</p>
      ) : null}
      <Field label="Current password" htmlFor="pw-current">
        <PasswordInput id="pw-current" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoFocus />
      </Field>
      <Field label="New password" htmlFor="pw-next">
        <PasswordInput id="pw-next" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
      </Field>
      <Field label="Confirm new password" htmlFor="pw-confirm">
        <PasswordInput id="pw-confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="mt-1 flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? "Updating…" : "Update password"}
        </Button>
      </div>
    </form>
  );
}
