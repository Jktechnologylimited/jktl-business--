import Link from "next/link";
import { growth, query } from "@/lib/growth/service";
import { can } from "@/lib/admin-permissions";
import { growthModules } from "@/lib/growth/modules";
export const dynamic = "force-dynamic";
export default async function Page() {
  const a = await growth();
  const metrics: Record<string, unknown>[] = [];
  if (can(a.role, "growth_marketing", a.permissions)) {
    const r = (
      await query(
        "SELECT count(*) FILTER(WHERE status='draft')::int AS drafts,count(*) FILTER(WHERE status='published')::int AS published FROM jktl_publications WHERE growth_category IS NOT NULL AND(created_by=$1 OR $2)",
        [a.id, a.role === "owner"],
      )
    )[0];
    metrics.push(
      { label: "Content drafts", value: r?.drafts || 0 },
      { label: "Published announcements", value: r?.published || 0 },
    );
  }
  if (can(a.role, "growth_leads", a.permissions)) {
    const r = (
      await query(
        "SELECT count(*)::int n FROM prospects WHERE assigned_staff_id=$1 OR $2",
        [a.id, a.role === "owner"],
      )
    )[0];
    metrics.push({ label: "Assigned leads", value: r?.n || 0 });
  }
  if (can(a.role, "growth_applications", a.permissions)) {
    const rows = await query(
      "SELECT programme,count(*)::int n FROM affiliates WHERE status='pending' GROUP BY programme",
    );
    for (const r of rows)
      metrics.push({
        label: String(r.programme) + " applications",
        value: r.n,
      });
  }
  return (
    <div className="space-y-6 text-ink">
      <p>
        Welcome, {a.name}. Work with assigned leads, programme applicants and
        approved public content. Financial decisions and private client access
        remain with authorized operators.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => (
          <article
            className="rounded-xl border border-border bg-paper p-5"
            key={String(m.label)}
          >
            <p className="text-sm text-ink-muted">{String(m.label)}</p>
            <p className="mt-3 text-3xl font-semibold">{String(m.value)}</p>
          </article>
        ))}
      </div>
      <section>
        <h2 className="mb-4 text-xl font-semibold">Your workspace</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {growthModules
            .filter((m) => can(a.role, m.permission, a.permissions))
            .map((m) => (
              <Link
                className="rounded-xl border border-border bg-paper p-5"
                key={m.slug}
                href={"/admin/growth/" + m.slug}
              >
                {m.label} →
              </Link>
            ))}
        </div>
      </section>
      <p className="text-sm text-ink-muted">
        Social publishing and remote Fantasy administration require an
        authorized integration. No game scores, rewards or leaderboards can be
        changed here.
      </p>
    </div>
  );
}
