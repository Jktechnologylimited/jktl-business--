"use client";
import { useEffect, useRef, useState } from "react";
import {
  previewComposedEmailAction,
  reviewBusinessEmailAudienceAction,
  sendComposedEmailAction,
} from "@/lib/actions/email-compose-actions";
import {
  BUSINESS_EMAIL_AUDIENCES,
  BUSINESS_OUTREACH_TEMPLATES,
} from "@/lib/mail/business-outreach";
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
    audience: Object.hasOwn(audiences, "BUSINESS_ACCOUNTS")
      ? "BUSINESS_ACCOUNTS"
      : Object.keys(audiences)[0],
    selected: "",
    subject: "",
    body: "",
    replyTo: defaultReplyTo,
    kind: (Object.hasOwn(audiences, "BUSINESS_ACCOUNTS")
      ? "operational"
      : "marketing") as "marketing" | "operational",
  });
  const [preview, setPreview] = useState<Awaited<
      ReturnType<typeof previewComposedEmailAction>
    > | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [operational, setOperational] = useState(false);
  const [audienceReview, setAudienceReview] = useState<Awaited<
    ReturnType<typeof reviewBusinessEmailAudienceAction>
  > | null>(null);
  const [reviewError, setReviewError] = useState("");
  const businessAudience = Object.hasOwn(
    BUSINESS_EMAIL_AUDIENCES,
    raw.audience,
  );
  const businessAccess = Object.hasOwn(audiences, "BUSINESS_ACCOUNTS");
  useEffect(() => {
    if (!businessAudience) return;
    let active = true;
    const timer = setTimeout(() => {
      void reviewBusinessEmailAudienceAction({
        audience: raw.audience,
        kind: raw.kind,
        selected: raw.selected,
      })
        .then((result) => {
          if (active) {
            setAudienceReview(result);
            setReviewError("");
          }
        })
        .catch((e) => {
          if (active)
            setReviewError(
              e instanceof Error ? e.message : "Audience unavailable.",
            );
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [businessAudience, raw.audience, raw.kind, raw.selected]);
  const body = useRef<HTMLTextAreaElement>(null);
  function change(next: Partial<typeof raw>) {
    if (
      (next.audience && next.audience !== raw.audience) ||
      (next.kind && next.kind !== raw.kind)
    )
      setAudienceReview(null);
    setMessage("");
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
        Messages are sent individually through JKTL&apos;s existing provider.
        Preview the unique recipient count before confirming. Promotional mail
        requires opt-in and respects suppression preferences.
      </p>
      {businessAccess && (
        <section
          className="space-y-4 rounded-xl border border-border bg-paper p-5"
          aria-label="Business account outreach"
        >
          <h3 className="text-xl font-semibold">
            Start a conversation with your business accounts
          </h3>
          <p>
            Choose an audience and a starting message. Each account receives its
            own email; replies go to the Reply-To mailbox below.
          </p>
          <div className="flex flex-wrap gap-3">
            {BUSINESS_OUTREACH_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                className="rounded-lg border border-border px-4 py-3"
                disabled={busy}
                onClick={() =>
                  change({
                    audience: template.audience,
                    kind: template.kind,
                    subject: template.subject,
                    body: template.body,
                    replyTo: approvedReplyTo.includes("info@jktl.com.ng")
                      ? "info@jktl.com.ng"
                      : defaultReplyTo,
                  })
                }
              >
                {template.title}
              </button>
            ))}
          </div>
          <a className="text-primary underline" href="/admin/emails/branding">
            Manage Reply-To and company details
          </a>
        </section>
      )}
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
            aria-label="Recipient category"
            className="mt-2 block w-full max-w-full rounded border border-border bg-paper p-3"
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
        {businessAudience && (
          <section
            className="space-y-3 rounded-lg border border-border p-4"
            aria-label="Business audience review"
          >
            {reviewError ? (
              <p role="status">{reviewError}</p>
            ) : audienceReview ? (
              <>
                <p>
                  <b>
                    {audienceReview.matched} matching business-owner email
                    {audienceReview.matched === 1 ? "" : "s"}
                  </b>{" "}
                  · {audienceReview.eligible} eligible for this message type.
                </p>
                {raw.kind === "marketing" && (
                  <p className="text-sm text-ink-muted">
                    Promotional messages go to owners who opted in and are not
                    suppressed. No account preferences are changed.
                    {!audienceReview.hasPostalAddress && (
                      <>
                        {" "}
                        Add JKTL’s company postal address in{" "}
                        <a className="underline" href="/admin/emails/branding">
                          Email Branding
                        </a>{" "}
                        before sending promotions.
                      </>
                    )}
                  </p>
                )}
                {raw.audience === "NEW_BUSINESSES" && (
                  <p className="text-sm">
                    Accounts created within the last 30 days.
                  </p>
                )}
                {raw.audience === "EXISTING_BUSINESSES" && (
                  <p className="text-sm">
                    Accounts created more than 30 days ago.
                  </p>
                )}
                {raw.audience === "FREE_SUBDOMAINS" && (
                  <p className="text-sm">
                    Owners with a published free-subdomain website and no custom
                    domain configured for that site. Owners of unpublished sites
                    are excluded.
                  </p>
                )}
                {raw.audience === "SELECTED_BUSINESSES" && (
                  <button
                    type="button"
                    onClick={() =>
                      change({
                        selected: audienceReview.contacts
                          .map((c) => String(c.email))
                          .join(", "),
                      })
                    }
                  >
                    Select all listed owners
                  </button>
                )}
                <details>
                  <summary className="cursor-pointer">
                    Review account list
                  </summary>
                  <div className="mt-3 max-h-72 space-y-3 overflow-auto">
                    {audienceReview.contacts.map((c) => (
                      <div
                        className="break-words rounded border border-border p-3"
                        key={String(c.email)}
                      >
                        {raw.audience === "SELECTED_BUSINESSES" && (
                          <label className="mr-2">
                            <input
                              type="checkbox"
                              aria-label={"Select " + c.email}
                              checked={raw.selected
                                .split(/[\s,]+/)
                                .map((s) => s.toLowerCase())
                                .includes(String(c.email))}
                              onChange={(event) => {
                                const emails = new Set(
                                  raw.selected
                                    .split(/[\s,]+/)
                                    .filter(Boolean)
                                    .map((s) => s.toLowerCase()),
                                );
                                if (event.target.checked)
                                  emails.add(String(c.email));
                                else emails.delete(String(c.email));
                                change({ selected: [...emails].join(", ") });
                              }}
                            />{" "}
                            Select
                          </label>
                        )}
                        <b>{String(c.name)}</b> · {String(c.email)}
                        <p className="text-sm">
                          {(c.business_names as string[]).join(", ")}
                        </p>
                        <p className="text-sm">
                          {c.eligible
                            ? "Eligible"
                            : raw.audience === "SELECTED_BUSINESSES" &&
                                !raw.selected
                                  .split(/[\s,]+/)
                                  .includes(String(c.email))
                              ? "Not selected"
                              : c.marketing_suppressed || c.legacy_suppressed
                                ? "Promotional email suppressed"
                                : "Not opted in to promotional email"}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              </>
            ) : (
              <p role="status">Loading business accounts…</p>
            )}
          </section>
        )}
        {["SELECTED", "SELECTED_BUSINESSES"].includes(raw.audience) && (
          <label>
            Existing account emails, separated by commas or new lines
            <textarea
              aria-label="Selected account emails"
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
            aria-label="Message type"
            className="mt-2 block w-full max-w-full rounded border border-border bg-paper p-3"
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
          Replies open in your configured mailbox, such as info@jktl.com.ng.
          JKTL does not create a new inbox here. Overrides must be verified in
          Email Branding. Leaving this blank uses the configured default.
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
              The main message is necessary operational information, not a
              marketing campaign. The shared footer follows saved preferences.
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
