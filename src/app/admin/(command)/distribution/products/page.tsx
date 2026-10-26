import { guardAdminPage } from "@/lib/admin-page-guard";
import { query } from "@/lib/custom/service";
import { configurePartnerProductAction } from "@/lib/actions/partner-workspace-actions";
export const dynamic = "force-dynamic";
export default async function Page() {
  await guardAdminPage("manage_team");
  const rows = await query(
    "SELECT slug,name,partner_mode,partner_actions FROM feature_registry ORDER BY name",
  );
  return (
    <div className="space-y-5 text-ink">
      <h1 className="text-3xl font-semibold">Partner product access</h1>
      <p>
        Configure eligibility in the shared registry. Enabling a capability does
        not create an unsupported integration or bypass customer permissions and
        payment controls.
      </p>
      {rows.map((r) => (
        <form
          action={configurePartnerProductAction}
          key={String(r.slug)}
          className="space-y-3 rounded-xl border border-border p-5"
        >
          <strong>{String(r.name)}</strong>
          <input type="hidden" name="slug" value={String(r.slug)} />
          <label className="block">
            Mode
            <select
              name="mode"
              defaultValue={String(r.partner_mode)}
              className="ml-3 rounded border border-border bg-paper p-2"
            >
              {["UNAVAILABLE", "SELF_SERVICE", "ASSISTED", "QUOTE"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          {[
            "VIEW",
            "PREVIEW",
            "CONFIGURE",
            "MANAGE",
            "REQUEST_SETUP",
            "REQUEST_SUPPORT",
          ].map((v) => (
            <label key={v} className="mr-4 inline-flex gap-2">
              <input
                type="checkbox"
                name="actions"
                value={v}
                defaultChecked={(r.partner_actions as string[]).includes(v)}
              />
              {v}
            </label>
          ))}
          <button className="block rounded-lg bg-primary p-3 text-on-primary">
            Save access
          </button>
        </form>
      ))}
    </div>
  );
}
