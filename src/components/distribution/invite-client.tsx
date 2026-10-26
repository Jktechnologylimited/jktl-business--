"use client";
import { useState } from "react";
import { invitePartnerClientAction } from "@/lib/actions/partner-client-actions";
export function InviteClient() {
  const [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const label = String(new FormData(e.currentTarget).get("label"));
        setBusy(true);
        setError("");
        setUrl("");
        try {
          setUrl((await invitePartnerClientAction(label)).url);
        } catch {
          setError(
            "Could not create an invitation. Check your agreement and try again.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block">
        Client label
        <input
          name="label"
          required
          maxLength={160}
          className="mt-2 block w-full rounded-lg border border-border bg-paper p-3"
        />
      </label>
      <button
        disabled={busy}
        className="rounded-lg bg-primary p-3 text-on-primary"
      >
        {busy ? "Creating…" : "Create invitation link"}
      </button>
      {error && <p role="alert">{error}</p>}
      {url && (
        <div className="space-y-3">
          <p>
            Share privately with the business owner. The link expires in seven
            days and can be accepted once.
          </p>
          <input
            aria-label="Invitation link"
            readOnly
            value={url}
            className="w-full rounded-lg border border-border bg-paper p-3"
          />
          <button
            type="button"
            className="underline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
              } catch {
                setError("Select and copy the link above.");
              }
            }}
          >
            Copy link
          </button>
        </div>
      )}
    </form>
  );
}
