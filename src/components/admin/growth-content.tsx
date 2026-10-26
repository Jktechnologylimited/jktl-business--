import { growth, query } from "@/lib/growth/service";
import { ActionForm } from "@/components/distribution/action-form";
import {
  saveGrowthDraftAction,
  approveGrowthDraftAction,
  publishGrowthDraftAction,
} from "@/lib/actions/growth-actions";
import { can } from "@/lib/admin-permissions";
const input = "block w-full rounded-lg border border-border bg-paper p-3";
export async function GrowthContent({
  category,
}: {
  category?: "games" | "community";
}) {
  const a = await growth(
    category === "games"
      ? "growth_games"
      : category === "community"
        ? "growth_community"
        : "growth_marketing",
  );
  const rows = await query(
    "SELECT id,slug,kind,title,excerpt,body,cover_image,status,revision,created_by,growth_category,growth_link,growth_approved_revision FROM jktl_publications WHERE growth_category IS NOT NULL AND(created_by=$1 OR $2) AND(CASE WHEN $3::text IS NULL THEN growth_category IN('marketing','social','landing') ELSE growth_category=$3 END) ORDER BY updated_at DESC LIMIT 50",
    [a.id, a.role === "owner", category || null],
  );
  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-semibold">
        {category === "games"
          ? "Game announcements"
          : category === "community"
            ? "Community announcements"
            : "Marketing & campaign content"}
      </h2>
      <p>
        Draft Blog or Releases & Updates content using the existing JKTL
        publishing system. An Owner must approve the exact revision before you
        publish. Social and landing-page categories are editorial briefs; they
        do not post to social platforms or change the Main homepage.
      </p>
      <DraftForm category={category} />
      {rows.map((r) => (
        <article
          className="space-y-4 rounded-xl border border-border bg-paper p-5"
          key={String(r.id)}
        >
          <h3 className="text-xl font-semibold">{String(r.title)}</h3>
          <p>
            {String(r.status)} · {String(r.growth_category)} · revision{" "}
            {String(r.revision)} ·{" "}
            {r.growth_approved_revision === r.revision
              ? "Owner approved"
              : "Review required"}
          </p>
          <details>
            <summary>Read exact content</summary>
            <p className="my-3">{String(r.excerpt)}</p>
            <p className="whitespace-pre-wrap">{String(r.body)}</p>
            {r.growth_link && (
              <p className="mt-3 break-all">
                Campaign URL:{" "}
                <a className="underline" href={String(r.growth_link)}>
                  {String(r.growth_link)}
                </a>
              </p>
            )}
          </details>
          {r.status === "draft" && r.created_by === a.id && (
            <details>
              <summary>Edit draft (clears approval)</summary>
              <DraftForm row={r} category={category} />
            </details>
          )}
          {r.status === "draft" && a.role === "owner" && (
            <ActionForm action={approveGrowthDraftAction}>
              <input type="hidden" name="id" value={String(r.id)} />
              <input type="hidden" name="revision" value={String(r.revision)} />
              <label className="flex gap-3">
                <input type="checkbox" name="approved" required />I reviewed
                this exact content, claims, destinations and image rights.
              </label>
              <button className="mt-3 rounded border border-border p-3">
                Approve revision
              </button>
            </ActionForm>
          )}
          {r.status === "draft" &&
            r.created_by === a.id &&
            can(a.role, "growth_publish_approved", a.permissions) && (
              <ActionForm action={publishGrowthDraftAction}>
                <input type="hidden" name="id" value={String(r.id)} />
                <input
                  type="hidden"
                  name="revision"
                  value={String(r.revision)}
                />
                <button
                  disabled={r.growth_approved_revision !== r.revision}
                  className="rounded-lg bg-primary p-3 text-on-primary disabled:opacity-50"
                >
                  Publish approved announcement
                </button>
              </ActionForm>
            )}
        </article>
      ))}
    </section>
  );
}
function DraftForm({
  row: r = {},
  category,
}: {
  row?: Record<string, unknown>;
  category?: string;
}) {
  return (
    <ActionForm
      action={saveGrowthDraftAction}
      className="grid gap-4 rounded-xl border border-border p-5"
    >
      <input type="hidden" name="id" value={String(r.id || "")} />
      <input type="hidden" name="revision" value={Number(r.revision || 0)} />
      <label>
        Category
        <select
          name="category"
          className={input}
          defaultValue={String(r.growth_category || category || "marketing")}
        >
          {(category ? [category] : ["marketing", "social", "landing"]).map(
            (c) => (
              <option key={c}>{c}</option>
            ),
          )}
        </select>
      </label>
      <label>
        Destination
        <select
          name="kind"
          className={input}
          defaultValue={String(r.kind || "release")}
        >
          <option value="release">Releases & Updates</option>
          <option value="blog">Blog</option>
        </select>
      </label>
      {[
        ["slug", "URL slug", 100],
        ["title", "Title", 180],
        ["excerpt", "Summary", 400],
        ["coverImage", "HTTPS image URL (optional)", 2000],
        ["link", "JKTL campaign destination (optional)", 2000],
      ].map(([key, label, max]) => (
        <label key={String(key)}>
          {String(label)}
          <input
            className={input}
            name={String(key)}
            required={!["coverImage", "link"].includes(String(key))}
            maxLength={Number(max)}
            defaultValue={String(
              r[
                key === "coverImage"
                  ? "cover_image"
                  : key === "link"
                    ? "growth_link"
                    : String(key)
              ] || "",
            )}
          />
        </label>
      ))}
      <label>
        Content
        <textarea
          name="body"
          required
          maxLength={60000}
          rows={8}
          className={input}
          defaultValue={String(r.body || "")}
        />
      </label>
      <button className="rounded-lg bg-primary p-3 text-on-primary">
        Save unpublished draft
      </button>
    </ActionForm>
  );
}
