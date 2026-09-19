"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { sendBroadcastAction } from "@/lib/actions/admin-actions";
import { formatRelativeDay } from "@/lib/format";
import type { AdminBroadcast } from "@/lib/db/admin";

const CATEGORIES = [
  { value: "downtime", label: "Downtime notice" },
  { value: "promotion", label: "Promotion" },
  { value: "other", label: "Other" },
];

/**
 * Sends a push notification to every business that has push on and hasn't
 * turned off platform announcements — reuses the exact same push
 * infrastructure as the operational notifications (new booking, low
 * stock, etc.), just fanned out across every business at once instead of
 * one. See sendBroadcastAction for the send itself; this is only the form
 * and the send history underneath it.
 */
export function BroadcastForm({ initialHistory }: { initialHistory: AdminBroadcast[] }) {
  const [category, setCategory] = useState("downtime");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  const [history, setHistory] = useState(initialHistory);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSent("");
    setSending(true);
    const result = await sendBroadcastAction({ category, title, body, url });
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(`Sent to ${result.data.recipientCount} device${result.data.recipientCount === 1 ? "" : "s"}.`);
    setHistory((h) => [result.data, ...h]);
    setTitle("");
    setBody("");
    setUrl("");
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-border p-4">
        <Field label="Category" htmlFor="bc-category">
          <Select id="bc-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title" htmlFor="bc-title">
          <Input id="bc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Scheduled maintenance tonight" required />
        </Field>
        <Field label="Message" htmlFor="bc-body">
          <Textarea id="bc-body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="JKTL Business will be briefly unavailable from 1–2am WAT for maintenance." required />
        </Field>
        <Field label="Link (optional)" htmlFor="bc-url" hint="Opened when the notification is tapped — defaults to the dashboard home.">
          <Input id="bc-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/business" />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {sent ? <p className="text-sm text-primary">{sent}</p> : null}
        <Button type="submit" disabled={sending} className="self-start">
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Send broadcast
        </Button>
      </form>

      <div>
        <h2 className="mb-3 font-display text-base font-semibold text-ink">History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-ink-muted">No broadcasts sent yet.</p>
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border">
            {history.map((b) => (
              <div key={b.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink">{b.title}</div>
                  <div className="truncate text-xs text-ink-muted">{b.body}</div>
                </div>
                <div className="shrink-0 text-right text-xs text-ink-muted">
                  <div>{b.recipientCount} sent</div>
                  <div>{formatRelativeDay(b.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
