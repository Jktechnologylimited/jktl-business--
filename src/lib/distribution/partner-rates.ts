import "server-only";
import { query } from "@/lib/custom/service";
/** Resolve by payment time, not reconciliation time. Old receipts keep the pre-amendment rate. */
export async function partnerWebsiteRate(
  affiliateId: string,
  contractId: string,
  paidAt: string,
  fallback: number,
) {
  const rows = await query(
    `SELECT COALESCE(
    (SELECT rate_bps FROM partner_commission_changes WHERE affiliate_id=$1 AND contract_id=$2 AND effective_at<=$3::timestamptz ORDER BY effective_at DESC,id DESC LIMIT 1),
    (SELECT previous_bps FROM partner_commission_changes WHERE affiliate_id=$1 AND contract_id=$2 ORDER BY effective_at,id LIMIT 1),
    $4::integer) rate`,
    [affiliateId, contractId, paidAt, fallback],
  );
  return Number(rows[0].rate);
}
export const CHANGE_PARTNER_RATE_SQL = `WITH locked AS MATERIALIZED (
 SELECT * FROM affiliates WHERE id=$1 AND programme='partner' AND status IN('active','suspended') AND commission_model IN('percentage','policy') AND commission_bps=$3 FOR UPDATE
), eligible AS (
 SELECT a.*,c.id contract_id FROM locked a LEFT JOIN distribution_contracts c ON c.affiliate_id=a.id AND c.status='ACTIVE' AND c.model='REFERRAL'
 WHERE (a.commission_model='percentage' AND NOT EXISTS(SELECT 1 FROM distribution_contracts x WHERE x.affiliate_id=a.id AND x.status IN('OFFERED','ACCEPTED','ACTIVE','SUSPENDED')))
 OR (a.commission_model='policy' AND $2::integer<=5000 AND (c.id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM distribution_contracts x WHERE x.affiliate_id=a.id AND x.status IN('OFFERED','ACCEPTED','ACTIVE','SUSPENDED'))))
), changed AS (
 INSERT INTO partner_commission_changes(affiliate_id,contract_id,previous_bps,rate_bps,reason,changed_by)
 SELECT id,contract_id,commission_bps,$2,$4,$5 FROM eligible WHERE commission_bps<>$2 RETURNING *
), updated AS (
 UPDATE affiliates a SET commission_bps=c.rate_bps FROM changed c WHERE a.id=c.affiliate_id RETURNING a.id
), logged AS (
 INSERT INTO distribution_audit(actor_id,event,affiliate_id,detail)
 SELECT $5,'PARTNER_COMMISSION_CHANGED',c.affiliate_id,jsonb_build_object('change',c.id,'contract',c.contract_id,'previousBps',c.previous_bps,'rateBps',c.rate_bps,'effectiveAt',c.effective_at,'reason',c.reason,'scope',CASE WHEN c.contract_id IS NULL AND EXISTS(SELECT 1 FROM eligible e WHERE e.id=c.affiliate_id AND e.commission_model='policy') THEN 'proposal_requires_contract' ELSE 'future_website_payments' END) FROM changed c JOIN updated u ON u.id=c.affiliate_id RETURNING id
) SELECT c.rate_bps,c.effective_at,c.contract_id,EXISTS(SELECT 1 FROM eligible e WHERE e.id=c.affiliate_id AND e.commission_model='policy' AND c.contract_id IS NULL) proposal FROM changed c WHERE EXISTS(SELECT 1 FROM logged)`;
