import { query } from "@/lib/custom/service";
import { MAIL_CATEGORIES } from "@/lib/mail/layout";
import { ActionForm } from "@/components/distribution/action-form";
import { saveMailPromotionAction } from "@/lib/actions/mail-admin-actions";
const input = "block w-full rounded border border-border bg-paper p-3";
export default async function PromotionSettings() {
  const rows = await query(
    "SELECT * FROM email_promotions ORDER BY priority,id",
  );
  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-semibold">Email Promotions</h2>
      <p>
        Lower priority numbers appear first. Enable, schedule and reorder
        approved product messages without redeploying. Times below are UTC. Use
        the preview below to check sample eligibility.
      </p>
      <details>
        <summary className="font-semibold">Create a promotion</summary>
        <PromotionForm />
      </details>
      {rows.map((r) => (
        <details
          key={String(r.id)}
          className="rounded-xl border border-border bg-paper p-4"
        >
          <summary className="font-semibold">
            {String(r.title)} · {r.enabled ? "Enabled" : "Disabled"} · Priority{" "}
            {String(r.priority)}
          </summary>
          <PromotionForm row={r} />
          <p className="mt-3 text-xs text-ink-muted">
            Updated {String(r.updated_at)} by{" "}
            {String(r.updated_by || "Initial seed")}
          </p>
        </details>
      ))}
    </section>
  );
}
function PromotionForm({ row: r = {} }: { row?: Record<string, unknown> }) {
  const time = (v: unknown) =>
    v ? new Date(String(v)).toISOString().slice(0, 16) : "";
  return (
    <ActionForm action={saveMailPromotionAction} className="mt-4 grid gap-4">
      <input type="hidden" name="id" value={String(r.id || "")} />
      <input type="hidden" name="revision" value={Number(r.revision || 0)} />
      {[
        ["title", "Title", 120],
        ["description", "Description", 500],
        ["url", "JKTL HTTPS destination URL", 2000],
      ].map(([k, l, max]) => (
        <label key={String(k)}>
          {String(l)}
          <input
            className={input}
            name={String(k)}
            maxLength={Number(max)}
            required
            defaultValue={String(r[String(k)] || "")}
          />
        </label>
      ))}
      <label>
        Product
        <select
          className={input}
          name="productId"
          defaultValue={String(r.product_id || "website-builder")}
        >
          {[
            "website-builder",
            "templates",
            "business-email",
            "domains",
            "plans",
            "partners",
            "affiliate-resources",
            "partner-support",
          ].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      <label>
        Priority
        <input
          className={input}
          name="priority"
          type="number"
          min={0}
          max={1000}
          required
          defaultValue={Number(r.priority ?? 50)}
        />
      </label>
      <label>
        Starts at (UTC)
        <input
          className={input}
          name="startsAt"
          type="datetime-local"
          defaultValue={time(r.starts_at)}
        />
      </label>
      <label>
        Expires at (UTC)
        <input
          className={input}
          name="endsAt"
          type="datetime-local"
          defaultValue={time(r.ends_at)}
        />
      </label>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-3 font-semibold">
          Eligible email categories
        </legend>
        {MAIL_CATEGORIES.filter(
          (c) => !["security", "internal"].includes(c),
        ).map((c) => (
          <label key={c} className="flex gap-2">
            <input
              type="checkbox"
              name="categories"
              value={c}
              defaultChecked={((r.categories as string[]) || []).includes(c)}
            />
            {c.replaceAll("_", " ")}
          </label>
        ))}
      </fieldset>
      <label className="flex gap-3">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={r.enabled !== false}
        />
        Enabled
      </label>
      <button className="rounded-lg bg-primary p-3 text-on-primary">
        Save promotion
      </button>
    </ActionForm>
  );
}
