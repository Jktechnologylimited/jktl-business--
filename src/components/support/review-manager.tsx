"use client";
import { useState } from "react";
import {
  adminReviewsAction,
  moderateReviewAction,
} from "@/lib/actions/review-actions";
type Row = Record<string, unknown>;
export function ReviewManager({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function moderate(id: string, publish: boolean) {
    setBusy(true);
    try {
      const result = await moderateReviewAction(id, publish);
      if (!result.ok) throw Error(result.error);
      setRows(await adminReviewsAction());
      setMessage("Moderation saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not moderate.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-5" style={{ overflowWrap: "anywhere" }}>
      <h1 className="text-3xl font-semibold">Customer reviews</h1>
      <p className="max-w-3xl text-sm leading-7 text-ink-muted">
        Every rating is retained. Publish only an authentic review with explicit
        current consent. The public collection is labelled selected reviews; it
        is not an overall average. Wording and rating cannot be edited here.
        Withdrawn reviews cannot be republished.
      </p>
      {message && <p role="status">{message}</p>}
      {rows.length === 0 && <p>No feedback has been submitted yet.</p>}
      {rows.map((r) => (
        <article
          key={String(r.id)}
          className="rounded-2xl border border-border bg-paper p-5"
        >
          <p className="text-xs text-ink-muted">
            {String(r.rating)} / 5 · {String(r.status)} · {String(r.milestone)}
          </p>
          <blockquote className="my-4 whitespace-pre-wrap text-lg leading-8">
            {String(r.quote)}
          </blockquote>
          <p className="text-sm">
            {String(r.display_name)} · {String(r.company)}
          </p>
          <p className="my-3 text-xs text-ink-muted">
            Public consent: {r.public_consent ? "Granted" : "Not granted"}
          </p>
          <div className="flex gap-3">
            <button
              disabled={busy || !r.public_consent || r.status === "WITHDRAWN"}
              className="rounded-xl bg-primary px-4 py-2 text-on-primary disabled:opacity-50"
              onClick={() => void moderate(String(r.id), true)}
            >
              Publish exact review
            </button>
            <button
              disabled={busy || r.status === "WITHDRAWN"}
              className="rounded-xl border border-border-strong px-4 py-2"
              onClick={() => void moderate(String(r.id), false)}
            >
              Keep private / unpublish
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
