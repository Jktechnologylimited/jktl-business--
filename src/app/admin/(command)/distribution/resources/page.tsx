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
    "SELECT id,title,enabled FROM distribution_assets ORDER BY created_at DESC",
  );
  return (
    <div className="space-y-5 text-ink">
      <h1 className="text-3xl font-semibold">Approved marketing library</h1>
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
        ))}
      </section>
    </div>
  );
}
