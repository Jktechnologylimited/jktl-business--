import { growth, query } from "@/lib/growth/service";
import { ActionForm } from "@/components/distribution/action-form";
import {
  approveGrowthDraftAction,
  publishGrowthDraftAction,
} from "@/lib/actions/growth-actions";
import { can } from "@/lib/admin-permissions";
import { GrowthContentEditor } from "./growth-content-editor";
import { GrowthSavedPreview } from "./growth-content-preview";
import type { GrowthMedia } from "@/lib/growth/content";
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
  const media: GrowthMedia[] = (
    await query(
      "SELECT id,url,alt FROM editorial_media WHERE created_by=$1 OR $2 ORDER BY created_at DESC LIMIT 24",
      [a.id, a.role === "owner"],
    )
  ).map((image) => ({
    id: String(image.id),
    url: String(image.url),
    alt: String(image.alt),
  }));
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
      <GrowthContentEditor
        category={category}
        media={media}
        uploadsAvailable={!!process.env.BLOB_READ_WRITE_TOKEN}
      />
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
          <GrowthSavedPreview
            key={String(r.id) + ":" + String(r.revision)}
            revision={Number(r.revision)}
            content={{
              title: String(r.title),
              excerpt: String(r.excerpt),
              body: String(r.body),
              coverImage: String(r.cover_image || ""),
              kind: String(r.kind),
              slug: String(r.slug),
            }}
          >
            {r.growth_link && (
              <p className="mt-3 break-all">
                Campaign URL:{" "}
                <a className="underline" href={String(r.growth_link)}>
                  {String(r.growth_link)}
                </a>
              </p>
            )}
            {r.status === "draft" && a.role === "owner" && (
              <ActionForm action={approveGrowthDraftAction}>
                <input type="hidden" name="id" value={String(r.id)} />
                <input
                  type="hidden"
                  name="revision"
                  value={String(r.revision)}
                />
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
                  <label className="mb-3 flex items-start gap-3">
                    <input
                      type="checkbox"
                      name="previewed"
                      required
                      className="mt-1"
                    />
                    I previewed this saved revision, including its images and
                    links, and am ready to publish it live.
                  </label>
                  <button
                    disabled={r.growth_approved_revision !== r.revision}
                    className="rounded-lg bg-primary p-3 text-on-primary disabled:opacity-50"
                  >
                    Publish approved announcement
                  </button>
                </ActionForm>
              )}
          </GrowthSavedPreview>
          {r.status === "draft" && r.created_by === a.id && (
            <details>
              <summary>Edit draft (clears approval)</summary>
              <GrowthContentEditor
                key={String(r.revision)}
                row={r}
                category={category}
                media={media}
                uploadsAvailable={!!process.env.BLOB_READ_WRITE_TOKEN}
              />
            </details>
          )}
        </article>
      ))}
    </section>
  );
}
