"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/field";

export function PasswordForm({ onSubmit, onCancel }: { onSubmit: () => void; onCancel: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
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
    onSubmit();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-xs text-ink-muted">
        This is a mock form — no account system is connected yet, so nothing is actually changed. Real password
        changes arrive with Phase 2.
      </p>
      <Field label="Current password" htmlFor="pw-current">
        <Input id="pw-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoFocus />
      </Field>
      <Field label="New password" htmlFor="pw-next">
        <Input id="pw-next" type="password" value={next} onChange={(e) => setNext(e.target.value)} required />
      </Field>
      <Field label="Confirm new password" htmlFor="pw-confirm">
        <Input id="pw-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="mt-1 flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1">
          Update password
        </Button>
      </div>
    </form>
  );
}
