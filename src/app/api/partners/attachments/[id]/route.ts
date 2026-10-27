import { query } from "@/lib/custom/service";
import { getAffiliateSession } from "@/lib/affiliate-session";
import { getAdminSession } from "@/lib/admin-session";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return new Response("Not found", { status: 404 });
  const [partner, admin] = await Promise.all([
    getAffiliateSession(),
    getAdminSession(),
  ]);
  if (!partner && !admin)
    return new Response("Sign in required", { status: 401 });
  const a = (
    await query(
      `SELECT f.file_name,f.mime,f.body FROM partner_ticket_attachments f JOIN partner_tickets t ON t.id=f.ticket_id WHERE f.id=$1 AND(EXISTS(SELECT 1 FROM affiliates p WHERE p.id=$2 AND p.id=t.partner_id AND p.status='active' AND (p.programme='affiliate' OR p.programme='partner' AND p.partner_terms_confirmed=true)) OR($3='owner' OR ($3='support' OR $3 IN('affiliate_manager','growth_gaming_lead') AND EXISTS(SELECT 1 FROM affiliates ap WHERE ap.id=t.partner_id AND ap.programme='affiliate')) AND t.sensitive=false AND(t.assigned_to IS NULL OR t.assigned_to=$4)))`,
      [
        id,
        partner?.id || null,
        admin?.role === "growth_gaming_lead" &&
        admin.permissions?.growth_community === false
          ? null
          : admin?.role || null,
        admin?.id || null,
      ],
    )
  )[0];
  if (!a) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(String(a.body), "base64"), {
    headers: {
      "Content-Type": String(a.mime),
      "Content-Disposition":
        'attachment; filename="' +
        String(a.file_name).replace(/["\r\n]/g, "_") +
        '"',
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "Cache-Control": "private, no-store",
    },
  });
}
