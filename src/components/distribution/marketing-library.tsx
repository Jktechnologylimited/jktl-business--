import { requireAffiliateSession } from "@/lib/affiliate-session";
import { query } from "@/lib/custom/service";
export async function MarketingLibrary() {
  const p = await requireAffiliateSession();
  const rows = await query(
    "SELECT id,title,description,url FROM distribution_assets WHERE enabled=true AND(audience='BOTH' OR audience=upper($1)) ORDER BY created_at DESC",
    [p.programme || "affiliate"],
  );
  return (
    <div className="space-y-5 text-ink">
      <h1 className="text-3xl font-semibold">Approved marketing resources</h1>
      <p>
        Use the JKTL logo and approved descriptions. Do not alter product
        claims, imply unapproved pricing or promise guaranteed earnings.
      </p>
      {rows.map((r) => (
        <article
          key={String(r.id)}
          className="rounded-xl border border-border p-5"
        >
          <h2 className="font-semibold">{String(r.title)}</h2>
          <p className="my-3">{String(r.description)}</p>
          <a
            href={String(r.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Open approved resource
          </a>
        </article>
      ))}
    </div>
  );
}
