import { MarketingUploadForm } from "@/components/distribution/marketing-upload-form";
import { ActionForm } from "@/components/distribution/action-form";
import { query } from "@/lib/custom/service";
import { guardAdminPage } from "@/lib/admin-page-guard";
import {
  saveDistributionAssetAction,
  toggleDistributionAssetAction,
} from "@/lib/actions/distribution-program-actions";
export default async function Page() {
  await guardAdminPage("manage_team");
  const assets = await query(
    "SELECT * FROM distribution_assets ORDER BY created_at DESC",
  );
  return (
    <div className="space-y-5 text-ink">
      <h1 className="text-3xl font-semibold">Approved marketing library</h1>
      <MarketingUploadForm />
      <ActionForm action={saveDistributionAssetAction} className="grid gap-4">
        <label>
          Title
          <input
            name="title"
            required
            minLength={3}
            maxLength={160}
            className="block w-full rounded border border-border bg-paper p-3"
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            maxLength={2000}
            className="block w-full rounded border border-border bg-paper p-3"
          />
        </label>
        <label>
          Approved asset URL
          <input
            name="url"
            type="url"
            required
            pattern="https://.*"
            className="block w-full rounded border border-border bg-paper p-3"
          />
        </label>
        <label>
          Format
          <select
            name="kind"
            className="ml-2 rounded border border-border bg-paper p-2"
          >
            {["LINK", "GRAPHIC", "SOCIAL", "DM", "EMAIL", "FOLLOW_UP"].map(
              (k) => (
                <option key={k}>{k}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Product
          <select
            name="product"
            className="ml-2 rounded border border-border bg-paper p-2"
          >
            {[
              "general",
              "website-builder",
              "templates",
              "domains",
              "business-email",
              "business-tools",
            ].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          Promotional copy (use {"{referralUrl}"} for the Affiliate link)
          <textarea
            name="copy"
            className="block w-full rounded border border-border bg-paper p-3"
            maxLength={10000}
          />
        </label>
        <label>
          <input type="checkbox" name="featured" />
          Featured
        </label>
        <label>
          Visibility
          <select
            name="audience"
            className="ml-2 rounded border border-border bg-paper p-2"
          >
            <option>BOTH</option>
            <option>AFFILIATE</option>
            <option>PARTNER</option>
          </select>
        </label>
        <label>
          <input type="checkbox" name="approved" required />I approve this
          resource for promotion and confirm its rights and claims.
        </label>
        <button className="rounded-lg bg-primary p-3 text-on-primary">
          Publish approved resource
        </button>
      </ActionForm>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Resource visibility</h2>
        {assets.map((a) => (
          <article
            key={String(a.id)}
            className="space-y-3 rounded-lg border border-border p-4"
          >
            <details>
              <summary>Edit {String(a.title)}</summary>
              <ActionForm
                action={saveDistributionAssetAction}
                className="grid gap-3 pt-4"
              >
                <input name="id" type="hidden" value={String(a.id)} />
                <label>
                  Title
                  <input
                    name="title"
                    required
                    minLength={3}
                    maxLength={160}
                    defaultValue={String(a.title)}
                    className="block w-full rounded border border-border bg-paper p-3"
                  />
                </label>
                <label>
                  Description
                  <textarea
                    name="description"
                    defaultValue={String(a.description)}
                    maxLength={2000}
                    className="block w-full rounded border border-border bg-paper p-3"
                  />
                </label>
                <label>
                  Approved HTTPS resource URL
                  <input
                    name="url"
                    type="url"
                    required
                    defaultValue={String(a.url)}
                    className="block w-full rounded border border-border bg-paper p-3"
                  />
                </label>
                <label>
                  Format
                  <select name="kind" defaultValue={String(a.kind)}>
                    {[
                      "LINK",
                      "GRAPHIC",
                      "SOCIAL",
                      "DM",
                      "EMAIL",
                      "FOLLOW_UP",
                    ].map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Product
                  <select name="product" defaultValue={String(a.product)}>
                    {[
                      "general",
                      "website-builder",
                      "templates",
                      "domains",
                      "business-email",
                      "business-tools",
                    ].map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Visibility
                  <select name="audience" defaultValue={String(a.audience)}>
                    {["AFFILIATE", "PARTNER", "BOTH"].map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Copy
                  <textarea
                    name="copy"
                    defaultValue={String(a.copy)}
                    maxLength={10000}
                    className="block w-full rounded border border-border bg-paper p-3"
                  />
                </label>
                <label>
                  <input
                    name="featured"
                    type="checkbox"
                    defaultChecked={Boolean(a.featured)}
                  />
                  Featured
                </label>
                <label>
                  <input
                    name="archived"
                    type="checkbox"
                    defaultChecked={Boolean(a.archived)}
                  />
                  Archive this material
                </label>
                <label>
                  <input name="approved" type="checkbox" required />I approve
                  this copy, asset rights and product claims
                </label>
                <button className="rounded border border-border p-3">
                  Save reviewed material
                </button>
              </ActionForm>
            </details>
            <ActionForm
              key={String(a.id)}
              action={toggleDistributionAssetAction}
              className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-4"
            >
              <span>
                {String(a.title)} · {a.enabled ? "Published" : "Hidden"}
              </span>
              <input type="hidden" name="id" value={String(a.id)} />
              <input
                type="hidden"
                name="enabled"
                value={a.enabled ? "false" : "true"}
              />
              <button className="rounded border border-border p-2">
                {a.enabled ? "Hide resource" : "Restore approved resource"}
              </button>
            </ActionForm>
          </article>
        ))}
      </section>
    </div>
  );
}
