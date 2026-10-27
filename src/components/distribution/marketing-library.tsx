import { requireAffiliateSession } from "@/lib/affiliate-session";
import { query } from "@/lib/custom/service";
import { MaterialCards } from "./material-cards";
export async function MarketingLibrary() {
  const p = await requireAffiliateSession();
  const rows = await query(
    "SELECT id,title,description,url,kind,product,copy,featured FROM distribution_assets WHERE enabled=true AND archived=false AND(audience='BOTH' OR audience=upper($1)) ORDER BY featured DESC,created_at DESC",
    [p.programme || "affiliate"],
  );
  return (
    <div className="space-y-5 text-ink">
      <h1 className="text-3xl font-semibold">Marketing Materials</h1>
      <p>
        Use approved JKTL branding and accurate product descriptions. Review
        current availability and pricing before sharing. Include the referral
        disclosure and contact only people you are permitted to message.
      </p>
      <MaterialCards
        items={rows.map((r) => ({
          id: String(r.id),
          title: String(r.title),
          description: String(r.description),
          url: String(r.url),
          kind: String(r.kind),
          product: String(r.product),
          copy: String(r.copy),
          featured: Boolean(r.featured),
        }))}
        referralUrl={
          "https://jktl.com.ng/?ref=" + encodeURIComponent(p.referralCode)
        }
      />
    </div>
  );
}
