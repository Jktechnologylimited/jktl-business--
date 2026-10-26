import { query } from "@/lib/custom/service";
import { brandingSettings } from "@/lib/mail/layout";
import { ActionForm } from "@/components/distribution/action-form";
import { saveMailBrandingAction } from "@/lib/actions/mail-admin-actions";
export const dynamic = "force-dynamic";
const input = "block w-full rounded border border-border bg-paper p-3";
export default async function Page() {
  const row = (
      await query("SELECT settings,revision FROM email_branding WHERE id=true")
    )[0],
    b = brandingSettings(row?.settings);
  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-semibold">Email Branding</h2>
      <p>
        These settings affect official JKTL email layout. Sender addresses and
        delivery credentials keep their existing configuration. Changes apply
        without redeploying; connected apps refresh public branding within a
        minute.
      </p>
      <ActionForm
        action={saveMailBrandingAction}
        className="grid gap-4 rounded-xl border border-border bg-paper p-5"
      >
        <input
          type="hidden"
          name="revision"
          value={Number(row?.revision || 1)}
        />
        {[
          ["companyName", "Company name"],
          ["logoUrl", "Absolute HTTPS logo URL"],
          ["headerColor", "Header background (dark hex color)"],
          ["signature", "Default signature"],
          ["supportEmail", "Support email"],
          ["supportUrl", "JKTL support URL"],
          ["phone", "Support phone (optional)"],
          [
            "postalAddress",
            "Genuine company postal address (required before marketing)",
          ],
          ["copyright", "Copyright ({year} is replaced automatically)"],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              name={key}
              className={input}
              defaultValue={String(b[key as keyof typeof b])}
              required={!["phone", "postalAddress"].includes(key)}
              maxLength={key === "logoUrl" ? 2000 : 500}
            />
          </label>
        ))}
        <label>
          Header alignment
          <select name="alignment" className={input} defaultValue={b.alignment}>
            <option>left</option>
            <option>center</option>
          </select>
        </label>
        {["facebook", "instagram", "linkedin"].map((label) => (
          <label key={label}>
            {label} HTTPS URL (optional)
            <input
              className={input}
              name={label}
              type="url"
              defaultValue={
                b.socialLinks.find((s) => s.label === label)?.url || ""
              }
            />
          </label>
        ))}
        <label className="flex gap-3">
          <input
            type="checkbox"
            name="promotionsEnabled"
            defaultChecked={b.promotionsEnabled}
          />
          Allow optional promotions for eligible, opted-in recipients
        </label>
        <label className="flex gap-3">
          <input
            type="checkbox"
            name="supportPromotions"
            defaultChecked={b.supportPromotions}
          />
          Allow optional promotions in support correspondence
        </label>
        <label>
          Maximum promotions (0–3)
          <input
            className={input}
            name="maxPromotions"
            type="number"
            min={0}
            max={3}
            required
            defaultValue={b.maxPromotions}
          />
        </label>
        <p className="text-sm text-ink-muted">
          Security and internal emails never contain promotional product
          listings. Missing preferences, an opt-out, unavailable products or
          missing postal information suppress optional promotions.
        </p>
        <button className="rounded-lg bg-primary p-3 text-on-primary">
          Save email branding
        </button>
      </ActionForm>
    </section>
  );
}
