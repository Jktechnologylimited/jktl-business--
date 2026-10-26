import { guardAdminPage } from "@/lib/admin-page-guard";
import { query } from "@/lib/custom/service";
import { respondPartnerServiceAction } from "@/lib/actions/partner-client-actions";
export const dynamic = "force-dynamic";
export default async function Requests() {
  await guardAdminPage("manage_affiliates");
  const rows = await query(
    `SELECT q.*,i.label,a.name,r.revoked_at FROM partner_service_requests q JOIN partner_client_access r ON r.id=q.relationship_id JOIN partner_client_invitations i ON i.id=r.invitation_id JOIN affiliates a ON a.id=r.partner_id ORDER BY q.created_at DESC LIMIT 100`,
  );
  return (
    <div className="space-y-5 text-ink">
      <h1 className="text-3xl font-semibold">Partner service requests</h1>
      <p>
        Review and coordinate assistance here. Completing a request does not
        mark an order paid or provision a service. Revoked client permission
        must be restored by the owner before further account assistance.
      </p>
      {rows.map((r) => (
        <article
          key={String(r.id)}
          className="space-y-3 rounded-xl border border-border p-5"
        >
          <h2 className="font-semibold">
            {String(r.name)} · {String(r.label)} · {String(r.product)}
          </h2>
          <p className="whitespace-pre-wrap break-words">{String(r.message)}</p>
          <p>
            {String(r.status)}
            {r.revoked_at ? " · CLIENT ACCESS REVOKED" : ""}
          </p>
          <form action={respondPartnerServiceAction} className="grid gap-3">
            <input type="hidden" name="id" value={String(r.id)} />
            <label>
              Status
              <select
                name="status"
                defaultValue={String(r.status)}
                className="ml-3 rounded border border-border bg-paper p-2"
              >
                {["OPEN", "IN_REVIEW", "COMPLETED", "DECLINED"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Reply
              <textarea
                name="reply"
                maxLength={2000}
                required
                defaultValue={String(r.reply)}
                className="mt-2 block w-full rounded border border-border bg-paper p-3"
              />
            </label>
            <button className="rounded-lg bg-primary p-3 text-on-primary">
              Save response
            </button>
          </form>
        </article>
      ))}
    </div>
  );
}
