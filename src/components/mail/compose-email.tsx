"use client";
import { useRef, useState } from "react";
import {
  previewComposedEmailAction,
  sendComposedEmailAction,
} from "@/lib/actions/email-compose-actions";
export function ComposeEmail({
  audiences,
  defaultReplyTo,
  approvedReplyTo,
}: {
  audiences: Record<string, string>;
  defaultReplyTo: string;
  approvedReplyTo: string[];
}) {
  const [raw, setRaw] = useState({
    audience: Object.keys(audiences)[0],
    selected: "",
    subject: "",
    body: "",
    replyTo: defaultReplyTo,
    kind: "marketing" as "marketing" | "operational",
  });
  const [preview, setPreview] = useState<Awaited<
      ReturnType<typeof previewComposedEmailAction>
    > | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [operational, setOperational] = useState(false);
  const body = useRef<HTMLTextAreaElement>(null);
  function change(next: Partial<typeof raw>) {
    setRaw({ ...raw, ...next });
    setPreview(null);
    setConfirmed(false);
    setOperational(false);
  }
  function format(start: string, end: string) {
    const node = body.current;
    if (!node) return;
    change({
      body:
        raw.body.slice(0, node.selectionStart) +
        start +
        raw.body.slice(node.selectionStart, node.selectionEnd) +
        end +
        raw.body.slice(node.selectionEnd),
    });
    node.focus();
  }
  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-semibold">Compose Email</h2>
      <p>
        Messages are sent individually through JKTL&apos;s existing provider. Preview
        the unique recipient count before confirming. Promotional mail requires
        opt-in and respects suppression preferences.
      </p>
      <form
        className="grid gap-4 rounded-xl border border-border bg-paper p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          try {
            setPreview(await previewComposedEmailAction(raw));
            setConfirmed(false);
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Preview unavailable.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Recipient category
          <select
            className="ml-3 rounded border border-border bg-paper p-3"
            value={raw.audience}
            onChange={(e) => change({ audience: e.target.value })}
          >
            {Object.entries(audiences).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
        </label>
        {raw.audience === "SELECTED" && (
          <label>
            Existing account emails, separated by commas or new lines
            <textarea
              className="block w-full rounded border border-border bg-paper p-3"
              value={raw.selected}
              onChange={(e) => change({ selected: e.target.value })}
              required
              maxLength={20000}
            />
          </label>
        )}
        <label>
          Message type
          <select
            value={raw.kind}
            onChange={(e) =>
              change({ kind: e.target.value as typeof raw.kind })
            }
          >
            <option value="marketing">
              Promotional — opted-in recipients only
            </option>
            <option value="operational">
              Necessary account / programme information
            </option>
          </select>
        </label>
        <label>
          Subject
          <input
            className="block w-full rounded border border-border bg-paper p-3"
            required
            minLength={3}
            maxLength={160}
            value={raw.subject}
            onChange={(e) => change({ subject: e.target.value })}
          />
        </label>
        <label>
          Reply-To Email (optional)
          <input
            type="email"
            className="block w-full rounded border border-border bg-paper p-3"
            list="approved-reply-to"
            value={raw.replyTo}
            onChange={(e) => change({ replyTo: e.target.value })}
          />
        </label>
        <datalist id="approved-reply-to">
          {approvedReplyTo.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
        <small>
          Overrides must be verified in Email Branding. Leaving this blank uses
          the configured default.
        </small>
        <div className="flex flex-wrap gap-3" aria-label="Message formatting">
          {[
            ["Bold", "**", "**"],
            ["Italic", "*", "*"],
            ["List", "\n- ", ""],
            ["Link", "[", "](https://jktl.com.ng)"],
          ].map(([label, start, end]) => (
            <button
              key={label}
              type="button"
              onClick={() => format(start, end)}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          Message
          <textarea
            ref={body}
            className="block min-h-56 w-full rounded border border-border bg-paper p-3"
            required
            minLength={5}
            maxLength={20000}
            value={raw.body}
            onChange={(e) => change({ body: e.target.value })}
          />
        </label>
        <small>
          Use the same Markdown format as JKTL Editorial. The preview shows
          formatting; raw HTML and unsafe links are removed.
        </small>
        <button
          disabled={busy}
          className="rounded bg-primary p-3 text-on-primary"
        >
          Preview and count recipients
        </button>
      </form>
      <p role="status">{message}</p>
      {preview && (
        <div className="space-y-4">
          <p>
            <strong>{preview.count} unique eligible recipients.</strong>{" "}
            Reply-To: {preview.replyTo || "Provider default"}. No messages have
            been sent.
          </p>
          <iframe
            title="Composed email preview"
            sandbox=""
            srcDoc={preview.html}
            className="h-[38rem] w-full rounded-xl border border-border bg-white"
          />
          <label className="flex gap-3">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            I reviewed this message and confirm sending to these {preview.count}{" "}
            recipients.
          </label>
          {raw.kind === "operational" && (
            <label className="flex gap-3">
              <input
                type="checkbox"
                checked={operational}
                onChange={(e) => setOperational(e.target.checked)}
              />{" "}
              This is necessary operational information, not promotional
              content.
            </label>
          )}
          <button
            disabled={
              busy || !confirmed || (raw.kind === "operational" && !operational)
            }
            className="rounded bg-primary p-3 text-on-primary"
            onClick={async () => {
              setBusy(true);
              try {
                await sendComposedEmailAction({
                  id: preview.id,
                  count: preview.count,
                  confirmed,
                  operationalConfirmed: operational,
                });
                setPreview(null);
                setMessage(
                  "Email queued. Email History shows provider acceptance and failures; acceptance does not prove delivery.",
                );
              } catch (e) {
                setMessage(e instanceof Error ? e.message : "Could not queue.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Queue individual emails
          </button>
        </div>
      )}
    </section>
  );
}
