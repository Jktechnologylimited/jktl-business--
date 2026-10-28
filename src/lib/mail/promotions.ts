import "server-only";
import type { Query } from "@/lib/domains/model";
import { DEFAULT_PROMOTIONS, LEGACY_PROMOTION_IDS } from "./promotion-defaults";
import type { Promotion } from "./layout";
export async function initializePromotions(q: Query) {
  await q(
    `WITH locked AS(SELECT id,settings FROM email_branding WHERE id=true AND promotions_initialized_at IS NULL FOR UPDATE),
 eligible AS(SELECT * FROM locked WHERE COALESCE(settings->>'promotionsEnabled','true')<>'false' AND COALESCE(settings->>'maxPromotions','3')<>'0'
 AND NOT EXISTS(SELECT 1 FROM email_promotions WHERE updated_by IS NOT NULL OR revision>1)
 AND NOT EXISTS(SELECT 1 FROM distribution_audit WHERE event IN('EMAIL_PROMOTION_SAVED','EMAIL_PROMOTION_DELETED'))),
 retired AS(UPDATE email_promotions SET deleted_at=now(),enabled=false WHERE id=ANY($2::uuid[]) AND updated_by IS NULL AND revision=1 AND EXISTS(SELECT 1 FROM eligible) RETURNING id),
 seeded AS(INSERT INTO email_promotions(id,title,description,url,product_id,enabled,priority,categories,updated_by)
 SELECT p.id::uuid,p.title,p.description,p.url,p."productId",p.enabled,p.priority,p.categories,'system:footer-defaults'
 FROM jsonb_to_recordset($1::jsonb) p(id text,title text,description text,url text,"productId" text,enabled boolean,priority int,categories text[])
 WHERE EXISTS(SELECT 1 FROM eligible) AND(SELECT count(*) FROM retired)>=0 ON CONFLICT(id) DO NOTHING RETURNING id),
 preserved AS(UPDATE email_promotions SET categories=array_append(categories,'invitation') WHERE NOT('invitation'=ANY(categories)) AND NOT('security'=ANY(categories)) AND NOT('internal'=ANY(categories)) AND EXISTS(SELECT 1 FROM locked) AND NOT EXISTS(SELECT 1 FROM eligible) RETURNING id),
 marked AS(UPDATE email_branding SET promotions_initialized_at=now() WHERE id IN(SELECT id FROM locked) AND(SELECT count(*) FROM seeded)>=0 AND(SELECT count(*) FROM preserved)>=0 RETURNING id)
 INSERT INTO distribution_audit(actor_id,event,detail) SELECT 'system','EMAIL_FOOTER_INITIALIZED',jsonb_build_object('defaults',(SELECT count(*) FROM seeded)) FROM marked`,
    [JSON.stringify(DEFAULT_PROMOTIONS), LEGACY_PROMOTION_IDS],
  );
}
export async function listPromotions(q: Query) {
  await initializePromotions(q);
  return q(
    "SELECT * FROM email_promotions WHERE deleted_at IS NULL ORDER BY priority,id",
    [],
  );
}
export function promotionRows(rows: Record<string, unknown>[]): Promotion[] {
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    description: String(r.description),
    url: String(r.url),
    productId: String(r.product_id || ""),
    priority: Number(r.priority),
    categories: r.categories as string[],
    enabled: r.enabled === true,
    startsAt: r.starts_at ? new Date(String(r.starts_at)).toISOString() : null,
    endsAt: r.ends_at ? new Date(String(r.ends_at)).toISOString() : null,
  }));
}
