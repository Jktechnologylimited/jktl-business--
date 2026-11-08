import { ActionForm } from "@/components/distribution/action-form";
import { approvedPartner } from "@/lib/partners/access";
import { query } from "@/lib/custom/service";
import { PartnerWorkspace } from "@/components/distribution/partner-workspace";
import { createPartnerWorkspaceAction } from "@/lib/actions/partner-workspace-actions";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; new?: string }>;
}) {
  const p = await approvedPartner();
  const { id, new: create } = await searchParams;
  const clients = await query(
    "SELECT id,business_name,organization_id FROM partner_workspaces WHERE partner_id=$1 ORDER BY created_at DESC",
    [p.id],
  );
  const products = await query(
    "SELECT slug,name,partner_mode FROM feature_registry WHERE partner_mode<>'UNAVAILABLE' AND slug<>'ai-receptionist' ORDER BY name",
  );
  return (
    <div className="space-y-7 text-ink">
      <h1 className="text-3xl font-semibold">Clients &amp; websites</h1>
      <p>
        Create the client workspace, build their website and connect the owner.
        Publish with permission, then add the services the business needs.
      </p>
      <details
        id="new-client"
        open={!clients.length || create === "1"}
        className="rounded-xl border border-border p-5"
      >
        <summary className="text-xl font-semibold">Create a new client</summary>
        <p className="mt-3 text-sm leading-7 text-ink-muted">
          Start with the business and its owner’s contact details. This creates
          a private draft; the owner connects their Business account through an
          invitation. No payment is taken.
        </p>
        <ActionForm
          action={createPartnerWorkspaceAction}
          className="mt-5 grid gap-4 md:grid-cols-2"
        >
          {[
            ["businessName", "Business name"],
            ["category", "Business category"],
            ["contactName", "Contact person"],
            ["contactEmail", "Contact email"],
            ["phone", "Phone"],
            ["country", "Country"],
            ["domain", "Preferred domain"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                name={key}
                required={[
                  "businessName",
                  "contactName",
                  "contactEmail",
                ].includes(key)}
                type={key === "contactEmail" ? "email" : "text"}
                maxLength={key === "contactEmail" ? 254 : 160}
                className="mt-1 block w-full rounded-lg border border-border bg-paper p-3"
              />
            </label>
          ))}
          <label>
            Website requirements
            <textarea
              name="requirements"
              maxLength={2000}
              className="mt-1 block w-full rounded-lg border border-border bg-paper p-3"
            />
          </label>
          <fieldset className="space-y-2">
            <legend>Required services (optional)</legend>
            {products.map((r) => (
              <label className="flex gap-3" key={String(r.slug)}>
                <input type="checkbox" name="services" value={String(r.slug)} />
                {String(r.name)}
              </label>
            ))}
          </fieldset>
          <button className="self-end rounded-lg bg-primary p-3 text-on-primary">
            Create client & start building
          </button>
        </ActionForm>
      </details>
      <PartnerWorkspace
        key={id || "workspace"}
        clients={clients.map((c) => ({
          id: String(c.id),
          name: String(c.business_name),
          claimed: Boolean(c.organization_id),
        }))}
        initialId={id}
      />
    </div>
  );
}
