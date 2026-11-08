"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePartnerRateAction } from "@/lib/actions/partner-rate-actions";
export function PartnerRateEditor({
  id,
  bps,
  policy,
  proposal = false,
  onSaved,
}: {
  id: string;
  bps: number;
  policy: boolean;
  proposal?: boolean;
  onSaved: (bps: number) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  return (
    <div className="my-4 rounded-xl border border-border bg-paper p-4 text-ink">
      <button
        type="button"
        className="font-semibold text-blue-600 underline"
        onClick={() => setOpen(!open)}
      >
        {open ? "Close commission editor" : "Edit commission percentage"}
      </button>
      {open && (
        <form
          className="mt-4 grid max-w-lg gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setPending(true);
            setMessage("");
            try {
              const r = await updatePartnerRateAction({
                id,
                percentage: String(f.get("percentage")),
                expectedBps: bps,
                reason: String(f.get("reason")),
                agreed: f.get("agreed") === "on",
              });
              if (r.ok && r.rateBps !== undefined) {
                onSaved(r.rateBps);
                setOpen(false);
                setMessage(
                  r.proposal
                    ? `Saved proposed percentage: ${r.rateBps / 100}%. Accept and activate Commercial terms before commissions can begin.`
                    : `Saved: ${r.rateBps / 100}%. Applies to future qualifying payments.`,
                );
                router.refresh();
              } else setMessage(r.error || "Could not save.");
            } catch {
              setMessage("Could not save. Please retry.");
            } finally {
              setPending(false);
            }
          }}
        >
          <p className="text-sm text-ink-muted">
            {proposal
              ? "Proposed website commission. The partner must accept Commercial terms and the Team must activate the agreement before commissions begin."
              : policy
                ? "Website subscription commission. Other product rules stay governed by their commercial terms."
                : "Agreed partner percentage."}{" "}
            Past earnings and payouts stay recorded at their original amounts.
          </p>
          <label className="grid gap-2 text-sm font-medium">
            Commission percentage (%)
            <input
              name="percentage"
              type="number"
              min="0"
              max={policy ? 50 : 100}
              step="0.01"
              defaultValue={bps / 100}
              required
              className="rounded-lg border border-border bg-paper p-3 text-ink"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Agreed change / reason
            <textarea
              name="reason"
              minLength={10}
              maxLength={3000}
              required
              className="rounded-lg border border-border bg-paper p-3 text-ink"
            />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="agreed" required className="mt-1" />I
            confirm this percentage has been agreed with the partner.
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-primary px-4 py-3 font-semibold text-on-primary disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save percentage"}
          </button>
        </form>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
