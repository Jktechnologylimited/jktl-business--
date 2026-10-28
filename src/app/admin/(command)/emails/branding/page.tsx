import { guardAdminPage } from "@/lib/admin-page-guard";
import {
  REPLY_CATEGORIES,
  senderIdentity,
  verifiedSenders,
} from "@/lib/mail/addresses";
import PromotionSettings from "@/components/mail/promotion-settings";
import { query } from "@/lib/custom/service";
import { brandingSettings } from "@/lib/mail/layout";
import { ActionForm } from "@/components/distribution/action-form";
import { saveMailBrandingAction } from "@/lib/actions/mail-admin-actions";
export const dynamic = "force-dynamic";
const input = "block w-full rounded border border-border bg-paper p-3";
export default async function Page() {
  await guardAdminPage("manage_communications");
  const sender = senderIdentity(
    process.env.RESEND_FROM_EMAIL ||
      "JKTL Business <jktl-business@mail.ibiz.name.ng>",
  );
  const row = (
      await query("SELECT settings,revision FROM email_branding WHERE id=true")
    )[0],
    b = brandingSettings(row?.settings);
  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-semibold">Email Branding</h2>
      <p>
        Branding, approved sender identities and Reply-To mailboxes apply to the
        existing email provider. New Reply-To addresses require mailbox
        verification by an authorized administrator. Sender-domain
        authentication stays in the existing secure configuration.
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
        <label>
          Sender Display Name
          <input
            name="senderDisplayName"
            className={input}
            defaultValue={b.senderDisplayName || sender.name}
            maxLength={100}
          />
        </label>
        <label>
          Sender Email Address
          <input
            name="senderEmail"
            type="email"
            className={input}
            defaultValue={b.senderEmail || sender.email}
            list="verified-senders"
            required
          />
        </label>
        <datalist id="verified-senders">
          {verifiedSenders().map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
        <p className="text-sm text-ink-muted">
          Only provider-verified sender addresses configured in the secure
          allowlist can be selected. This form does not verify or create sender
          domains.
        </p>
        <label>
          Default Reply-To Email Address
          <input
            name="defaultReplyTo"
            type="email"
            className={input}
            defaultValue={b.defaultReplyTo}
            placeholder="info@jktl.com.ng"
          />
        </label>
        <p className="text-sm text-ink-muted">
          Suggested: info@jktl.com.ng, once you have verified the mailbox exists
          and can receive replies. Blank leaves the provider&apos;s normal reply
          behavior unchanged.
        </p>
        <details>
          <summary>Optional category Reply-To mailboxes</summary>
          {REPLY_CATEGORIES.map((c) => (
            <label className="my-3 block" key={c}>
              {c}
              <input
                type="email"
                name={"reply_" + c}
                className={input}
                defaultValue={b.categoryReplyTo[c] || ""}
              />
            </label>
          ))}
          <p>
            Leave a category blank to use the default. No category-specific
            mailbox is assumed to exist.
          </p>
        </details>
        <label>
          Additional verified Reply-To mailboxes for individual overrides
          <textarea
            name="additionalReplyTo"
            className={input}
            defaultValue={b.verifiedReplyTo
              .filter(
                (v) =>
                  v !== b.defaultReplyTo &&
                  !Object.values(b.categoryReplyTo).includes(v),
              )
              .join("\n")}
          />
        </label>
        <label className="flex gap-3">
          <input type="checkbox" name="mailboxesVerified" /> I verified that
          every new or changed Reply-To mailbox exists and is authorized to
          receive JKTL replies.
        </label>
        <label>
          Default invitation expiry (hours)
          <input
            name="invitationHours"
            type="number"
            min={1}
            max={168}
            defaultValue={Number(
              (row?.settings as Record<string, unknown>)?.invitationHours || 48,
            )}
            className={input}
          />
        </label>
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
        <button className="rounded-lg bg-primary p-3 text-on-primary">
          Save email branding
        </button>
      </ActionForm>
      <PromotionSettings />
    </section>
  );
}
