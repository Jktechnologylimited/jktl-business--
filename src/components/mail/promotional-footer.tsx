"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  sendTestMailAction,
  setMailPromotionEnabledAction,
  footerManagerDataAction,
  saveFooterSettingsAction,
  saveMailPromotionAction,
  deleteMailPromotionAction,
  reorderMailPromotionAction,
  previewFooterDraftAction,
} from "@/lib/actions/mail-admin-actions";
type Data = Awaited<ReturnType<typeof footerManagerDataAction>>;
type Edit = {
  id: string;
  revision: number;
  title: string;
  description: string;
  url: string;
  enabled: boolean;
};
const field = "block w-full rounded border border-border bg-paper p-3";
export function PromotionalFooter({ initial }: { initial: Data }) {
  const router = useRouter();
  const [data, setData] = useState(initial),
    [enabled, setEnabled] = useState(initial.branding.promotionsEnabled),
    [max, setMax] = useState(initial.branding.maxPromotions),
    [edit, setEdit] = useState<Edit | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [sample, setSample] = useState("invite-writer"),
    [preview, setPreview] = useState<Awaited<
      ReturnType<typeof previewFooterDraftAction>
    > | null>(null),
    [deleting, setDeleting] = useState("");
  const form = (values: Record<string, unknown>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(values)) f.set(k, String(v));
    return f;
  };
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      const next = await footerManagerDataAction();
      setData(next);
      setEnabled(next.branding.promotionsEnabled);
      setMax(next.branding.maxPromotions);
      setPreview(null);
      setDeleting("");
      setEdit(null);
      router.refresh();
      setMessage("Saved. Future eligible emails use these settings.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not update footer.");
    } finally {
      setBusy(false);
    }
  }
  async function showPreview() {
    setBusy(true);
    try {
      setPreview(
        await previewFooterDraftAction({
          sample,
          enabled,
          max,
          candidate: edit || undefined,
        }),
      );
      setMessage(
        "Preview only. No email was sent and no invitation was created.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Preview unavailable.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="space-y-4 rounded-xl border border-border bg-paper p-5"
      id="promotional-footer"
    >
      <h2 className="text-2xl font-semibold">Promotional Footer</h2>
      <p>
        Explore More from JKTL appears after the signature in eligible emails.
        Security-critical messages never include it. New items start at the top;
        use the arrows to choose display order. Invitations and welcome emails
        include service links by default unless the recipient has opted out.
        Marketing emails still require consent and company postal details.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex gap-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              setPreview(null);
            }}
          />
          Promotional Footer: {enabled ? "ON" : "OFF"}
        </label>
        <label>
          Links per email
          <select
            value={max}
            onChange={(e) => {
              setMax(Number(e.target.value));
              setPreview(null);
            }}
          >
            {![3, 4].includes(max) && (
              <option value={max}>{max} (current)</option>
            )}
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </label>
        <button
          disabled={busy}
          onClick={() =>
            void run(() =>
              saveFooterSettingsAction(
                form({
                  enabled: enabled ? "on" : "",
                  maxPromotions: max,
                  revision: data.revision,
                }),
              ),
            )
          }
        >
          Save footer setting
        </button>
      </div>
      <button
        disabled={busy}
        onClick={() => {
          setEdit({
            id: "",
            revision: 0,
            title: "",
            description: "",
            url: "",
            enabled: true,
          });
          setPreview(null);
        }}
      >
        Add Promotion
      </button>
      {edit && (
        <form
          className="grid gap-3 rounded-lg border border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() =>
              saveMailPromotionAction(
                form({ ...edit, enabled: edit.enabled ? "on" : "" }),
              ),
            );
          }}
        >
          <h3>{edit.id ? "Edit promotion" : "Add Promotion"}</h3>
          {[
            ["title", "Title", 120],
            ["description", "Description", 500],
            ["url", "Destination URL", 2000],
          ].map(([key, label, length]) => (
            <label key={String(key)}>
              {String(label)}
              <input
                className={field}
                type={key === "url" ? "url" : "text"}
                required
                maxLength={Number(length)}
                value={String(edit[key as keyof Edit])}
                onChange={(e) => {
                  setEdit({ ...edit, [key]: e.target.value });
                  setPreview(null);
                }}
              />
            </label>
          ))}
          <label>
            Status
            <select
              value={edit.enabled ? "enabled" : "disabled"}
              onChange={(e) => {
                setEdit({ ...edit, enabled: e.target.value === "enabled" });
                setPreview(null);
              }}
            >
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <div className="flex gap-3">
            <button disabled={busy}>Save promotion</button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEdit(null);
                setPreview(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <ol className="space-y-3">
        {data.items.map((p, i) => (
          <li
            key={p.id}
            className="space-y-2 rounded-lg border border-border p-4"
          >
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline"
            >
              {p.title}
            </a>
            <p>{p.description}</p>
            <p>{p.enabled ? "Enabled" : "Disabled"}</p>
            <div className="flex flex-wrap gap-3">
              <button
                disabled={busy}
                onClick={() => {
                  setEdit({
                    id: p.id,
                    revision: p.revision,
                    title: p.title,
                    description: p.description,
                    url: p.url,
                    enabled: p.enabled,
                  });
                  setPreview(null);
                }}
              >
                Edit
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    setMailPromotionEnabledAction(
                      form({
                        id: p.id,
                        revision: p.revision,
                        enabled: p.enabled ? "off" : "on",
                      }),
                    ),
                  )
                }
              >
                {p.enabled ? "Disable" : "Enable"}
              </button>
              {["UP", "DOWN"].map((d) => (
                <button
                  key={d}
                  aria-label={`Move ${p.title} ${d.toLowerCase()}`}
                  disabled={
                    busy || (d === "UP" ? i === 0 : i === data.items.length - 1)
                  }
                  onClick={() =>
                    void run(() =>
                      reorderMailPromotionAction(
                        form({ id: p.id, revision: p.revision, direction: d }),
                      ),
                    )
                  }
                >
                  {d === "UP" ? "↑ Up" : "↓ Down"}
                </button>
              ))}
              <button disabled={busy} onClick={() => setDeleting(p.id)}>
                Delete
              </button>
            </div>
            {deleting === p.id && (
              <div>
                <p>
                  Delete this promotion? It will stay deleted, including after
                  deployments.
                </p>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      deleteMailPromotionAction(
                        form({ id: p.id, revision: p.revision, confirm: "on" }),
                      ),
                    )
                  }
                >
                  Confirm delete
                </button>
                <button onClick={() => setDeleting("")}>Cancel</button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {!data.items.length && (
        <p>
          No promotional items. This list will stay empty until you add a
          promotion.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <label>
          Email Preview
          <select
            value={sample}
            onChange={(e) => {
              setSample(e.target.value);
              setPreview(null);
            }}
          >
            {[
              ["invite-writer", "Role invitation"],
              ["invite-affiliate", "Affiliate invitation"],
              ["invite-partner", "Partner invitation"],
              ["registration", "Welcome email"],
              ["website", "Website notification"],
              ["security", "Password reset (no promotions)"],
            ].map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button disabled={busy} onClick={() => void showPreview()}>
          Preview complete email{edit ? " with unsaved changes" : ""}
        </button>
      </div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await sendTestMailAction(sample);
            setMessage(
              r.ok
                ? "Saved sample accepted by the provider for your own email. Check your inbox to confirm delivery and Gmail rendering."
                : "Test submission was not confirmed. Check provider configuration.",
            );
          } catch {
            setMessage(
              "Test submission was not confirmed. Check provider configuration.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        Send saved preview to my email
      </button>
      <p role="status">{message}</p>
      {preview && (
        <div>
          <p>{preview.warning}</p>
          <iframe
            sandbox=""
            title="Complete promotional footer email preview"
            srcDoc={preview.html}
            className="h-[40rem] w-full rounded border border-border bg-white"
          />
        </div>
      )}
    </section>
  );
}
