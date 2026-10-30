"use client";
import { useState } from "react";
import { ROLE_LABEL } from "@/lib/admin-permissions";
import {
  loadRecordCorrectionAction,
  saveRecordCorrectionAction,
  type CorrectionKind,
} from "@/lib/actions/record-correction-actions";
export function RecordDetailsEditor({
  kind,
  id,
}: {
  kind: CorrectionKind;
  id: string;
}) {
  const [open, setOpen] = useState(false),
    [original, setOriginal] = useState<Record<string, string> | null>(null),
    [details, setDetails] = useState<Record<string, string>>({}),
    [linkedEmail, setLinkedEmail] = useState<string | null>(null),
    [canEditEmail, setCanEditEmail] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    setBusy(true);
    setMessage("");
    try {
      const r = await loadRecordCorrectionAction(kind, id);
      if (r.ok) {
        setOriginal(r.data.details);
        setDetails(r.data.details);
        setLinkedEmail(r.data.linkedEmail);
        setCanEditEmail(r.data.canEditEmail);
        setOpen(true);
      } else setMessage(r.error);
    } catch {
      setMessage("Could not load details. Refresh and retry.");
    } finally {
      setBusy(false);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!original) return;
    const emailChanged =
        details.email.trim().toLowerCase() !==
        original.email.trim().toLowerCase(),
      roleChanged = details.role !== original.role;
    if (
      (emailChanged || roleChanged) &&
      !window.confirm(
        emailChanged
          ? "Correct this sign-in email? Linked Business, programme and team profiles will use the corrected email. Active sessions and old pending links will be revoked. Passwords and account IDs stay the same."
          : "Change this team role? Existing permissions will be cleared and the person will be signed out.",
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const r = await saveRecordCorrectionAction(kind, id, original, details);
      if (r.ok) {
        setMessage(
          r.data.sessionsRevoked
            ? "Saved. Affected sessions and pending links were revoked. Refreshing…"
            : "Details saved. Refreshing…",
        );
        window.location.reload();
      } else setMessage(r.error);
    } catch {
      setMessage("Save was not confirmed. Refresh before retrying.");
    } finally {
      setBusy(false);
    }
  }
  const label: Record<string, string> = {
    businessName: "Business name",
    name: kind === "customClient" ? "Owner name" : "Display name",
    email: "Email address",
    phone: "Owner phone",
    note: "Profile note",
    role: "Team role",
  };
  return (
    <div className="my-3 w-full text-sm">
      <button
        type="button"
        disabled={busy}
        className="rounded-lg border border-border px-3 py-2 font-medium text-ink"
        onClick={() => (open ? setOpen(false) : void load())}
      >
        {open ? "Cancel editing" : "Edit details"}
      </button>
      {open && original && (
        <form
          onSubmit={save}
          className="my-3 grid gap-3 rounded-xl border border-border bg-paper p-4 text-ink sm:grid-cols-2"
        >
          {Object.keys(original).map((key) => (
            <label className={key === "note" ? "sm:col-span-2" : ""} key={key}>
              {label[key] || key}
              {key === "role" ? (
                <select
                  disabled={busy}
                  value={details[key]}
                  className="mt-1 block w-full rounded border border-border bg-surface p-2"
                  onChange={(e) =>
                    setDetails({ ...details, [key]: e.target.value })
                  }
                >
                  {Object.entries(ROLE_LABEL).map(([value, name]) => (
                    <option key={value} value={value}>
                      {name}
                    </option>
                  ))}
                </select>
              ) : key === "note" ? (
                <textarea
                  disabled={busy}
                  className="mt-1 block w-full rounded border border-border bg-surface p-2"
                  rows={3}
                  maxLength={3000}
                  value={details[key]}
                  onChange={(e) =>
                    setDetails({ ...details, [key]: e.target.value })
                  }
                />
              ) : (
                <input
                  disabled={busy || (key === "email" && !canEditEmail)}
                  type={
                    key === "email" ? "email" : key === "phone" ? "tel" : "text"
                  }
                  required={key !== "phone"}
                  maxLength={key === "email" ? 254 : key === "phone" ? 50 : 200}
                  className="mt-1 block w-full rounded border border-border bg-surface p-2"
                  value={details[key]}
                  onChange={(e) =>
                    setDetails({ ...details, [key]: e.target.value })
                  }
                />
              )}
            </label>
          ))}
          {linkedEmail && (
            <p className="text-xs text-ink-muted sm:col-span-2">
              Linked Business login: {linkedEmail}. Email corrections apply to
              this identity and its linked profiles.
            </p>
          )}
          <p className="text-xs text-ink-muted sm:col-span-2">
            Account IDs, passwords, earnings, accepted agreements and existing
            invoices are preserved. Sign-in email corrections require an owner.
            If an invitation is still pending after an email correction, send a
            fresh invitation to the corrected address.
          </p>
          <button
            disabled={busy}
            type="submit"
            className="rounded bg-primary px-4 py-2 text-white"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </form>
      )}
      {message && (
        <p role="status" className="my-2 text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
