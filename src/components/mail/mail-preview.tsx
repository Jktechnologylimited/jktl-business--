"use client";
import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { MAIL_PREVIEWS } from "@/lib/mail/preview";
import {
  previewMailAction,
  sendTestMailAction,
} from "@/lib/actions/mail-admin-actions";
export function MailPreview() {
  const [id, setId] = useState("registration"),
    [data, setData] = useState<{
      html: string;
      text: string;
      category: string;
    } | null>(null),
    [mobile, setMobile] = useState(false),
    [tab, setTab] = useState("preview"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    setBusy(true);
    try {
      setData(await previewMailAction(id));
      setMessage(
        "Sample content only. No account, payment or service was changed.",
      );
    } catch {
      setMessage(
        "Preview unavailable. Check permissions and database configuration.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-semibold">Email Preview & Test</h2>
      <div className="flex flex-wrap gap-3">
        <label>
          Sample email
          <select
            className="ml-3 rounded border border-border bg-paper p-3"
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              setData(null);
            }}
          >
            {Object.entries(MAIL_PREVIEWS).map(([key, s]) => (
              <option key={key} value={key}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={busy}
          className="rounded border border-border p-3"
          onClick={load}
        >
          Load preview
        </button>
      </div>
      {message && <p role="status">{message}</p>}
      {data && (
        <>
          <p>
            Category: {data.category}. Promotions are simulated for an opted-in
            sample recipient; actual sends also check ownership, preferences and
            product availability.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              aria-label="Desktop email preview"
              aria-pressed={!mobile}
              className="rounded border border-border p-3"
              onClick={() => setMobile(false)}
            >
              <Monitor size={18} />
            </button>
            <button
              aria-label="Mobile email preview"
              aria-pressed={mobile}
              className="rounded border border-border p-3"
              onClick={() => setMobile(true)}
            >
              <Smartphone size={18} />
            </button>
            {["preview", "HTML", "plain text"].map((t) => (
              <button
                key={t}
                className="rounded border border-border p-3"
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "preview" ? (
            <iframe
              title="JKTL email preview"
              sandbox=""
              referrerPolicy="no-referrer"
              srcDoc={data.html}
              className="mx-auto block max-w-full rounded-xl border border-border"
              style={{ width: mobile ? 375 : "100%", height: 700 }}
            />
          ) : (
            <pre className="max-h-[700px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border p-5 text-xs">
              {tab === "HTML" ? data.html : data.text}
            </pre>
          )}
          <button
            disabled={busy}
            className="rounded-lg bg-primary p-3 text-on-primary"
            onClick={async () => {
              setBusy(true);
              try {
                const r = await sendTestMailAction(id);
                setMessage(
                  r.ok
                    ? "Test preview sent to your own staff email."
                    : r.error || "Test delivery failed.",
                );
              } catch {
                setMessage(
                  "Test unavailable. Check access, rate limit and delivery configuration.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Send test to my staff email
          </button>
        </>
      )}
    </section>
  );
}
