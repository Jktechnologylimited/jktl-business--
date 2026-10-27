import "server-only";
import { requireAffiliateSession } from "@/lib/affiliate-session";
import { query } from "@/lib/custom/service";
export async function approvedPartner() {
  const p = await requireAffiliateSession();
  if (
    !(
      await query(
        "SELECT 1 FROM affiliates WHERE id=$1 AND programme='partner' AND status='active' AND partner_terms_confirmed=true",
        [p.id],
      )
    ).length
  )
    throw Error("Approved partner agreement required");
  return p;
}
export async function workspace(id: string) {
  const p = await approvedPartner();
  const w = (
    await query(
      "SELECT * FROM partner_workspaces WHERE id=$1 AND partner_id=$2",
      [id, p.id],
    )
  )[0];
  if (!w) throw Error("Workspace unavailable");
  if (
    w.organization_id &&
    !(
      await query(
        "SELECT 1 FROM partner_client_access WHERE partner_id=$1 AND organization_id=$2 AND revoked_at IS NULL",
        [p.id, w.organization_id],
      )
    ).length
  )
    throw Error("Client access revoked");
  return { p, w };
}
export async function product(slug: string, action: string) {
  const r = (
    await query(
      "SELECT * FROM feature_registry WHERE slug=$1 AND partner_mode<>'UNAVAILABLE' AND $2=ANY(partner_actions)",
      [slug, action],
    )
  )[0];
  if (!r) throw Error("This product action is not available to partners");
  return r;
}

/** Ticket/alert access only. Workspace access still requires approvedPartner. */
export async function approvedProgramme() {
  const p = await requireAffiliateSession();
  if (
    !(
      await query(
        "SELECT 1 FROM affiliates WHERE id=$1 AND status='active' AND(programme='affiliate' OR programme='partner' AND partner_terms_confirmed=true)",
        [p.id],
      )
    ).length
  )
    throw Error("Approved programme account required");
  return p;
}
