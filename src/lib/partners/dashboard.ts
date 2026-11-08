import "server-only";
import { query } from "@/lib/custom/service";
export const PARTNER_CLIENTS_SQL = `SELECT w.id,w.business_name,w.organization_id,w.contact_name,w.contact_email,w.template_id,w.created_at,
 a.id IS NOT NULL access_active,
 COALESCE('MANAGE_WEBSITE_CONTENT'=ANY(a.scopes),false) can_edit,
 COALESCE('PUBLISH_WEBSITE'=ANY(a.scopes),false) can_publish,
 CASE WHEN 'MANAGE_WEBSITE_CONTENT'=ANY(a.scopes) THEN bp.website_template_id ELSE NULL END live_template,
 CASE WHEN 'MANAGE_WEBSITE_CONTENT'=ANY(a.scopes) THEN bp.published ELSE false END published,
 CASE WHEN 'MANAGE_WEBSITE_CONTENT'=ANY(a.scopes) AND bp.published THEN bp.subdomain ELSE NULL END subdomain
 FROM partner_workspaces w LEFT JOIN partner_client_access a ON a.partner_id=w.partner_id AND a.organization_id=w.organization_id AND a.revoked_at IS NULL
 LEFT JOIN business_profiles bp ON bp.organization_id=w.organization_id WHERE w.partner_id=$1 ORDER BY w.created_at DESC,w.id`;
export async function partnerDashboardClients(id: string) {
  return query(PARTNER_CLIENTS_SQL, [id]);
}
