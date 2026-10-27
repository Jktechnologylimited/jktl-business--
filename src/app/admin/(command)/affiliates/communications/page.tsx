import Link from "next/link";
import { guardAdminPage } from "@/lib/admin-page-guard";
import { query } from "@/lib/custom/service";
import { ActionForm } from "@/components/distribution/action-form";
import {
  draftAffiliateCampaignAction,
  confirmAffiliateCampaignAction,
} from "@/lib/actions/affiliate-communication-actions";
import { currentBranding } from "@/lib/mail/service";
import { mailAction, mailLayout } from "@/lib/mail/layout";
export const dynamic = "force-dynamic";
const escape = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export default async function Page() {
  await guardAdminPage("manage_affiliates");
  const campaigns = await query(
    "SELECT c.*,(SELECT count(*)::int FROM distribution_program_notices n WHERE n.event_key LIKE 'affiliate-campaign-'||c.id||'-%' AND n.delivered_at IS NULL AND n.suppressed_at IS NULL AND n.attempts>=10) exhausted,(SELECT count(*)::int FROM distribution_program_notices n WHERE n.event_key LIKE 'affiliate-campaign-'||c.id||'-%' AND n.delivered_at IS NOT NULL) accepted,(SELECT count(*)::int FROM distribution_program_notices n WHERE n.event_key LIKE 'affiliate-campaign-'||c.id||'-%' AND n.suppressed_at IS NOT NULL) suppressed FROM affiliate_campaigns c ORDER BY created_at DESC LIMIT 30",
  );
  const accounts = await query(
    "SELECT id,name,email,status FROM affiliates WHERE programme='affiliate' ORDER BY name LIMIT 100",
  );
  const brand = await currentBranding();
  const input = "block w-full rounded border border-border bg-paper p-3";
  return (
    <div className="space-y-5 text-ink">
      <h1 className="text-3xl font-semibold">Affiliate communications</h1>
      <p>
        Campaigns go only to opted-in recipients. Security invitations and
        financial notifications use their existing automatic workflows. Provider
        acceptance does not confirm inbox delivery.
      </p>
      <Link className="underline" href="/admin/affiliates/invitations">
        Invitations and secure reminders
      </Link>
      <ActionForm action={draftAffiliateCampaignAction} className="space-y-3">
        <label>
          Subject
          <input className={input} name="subject" required maxLength={160} />
        </label>
        <label>
          Message
          <textarea
            className={input}
            name="body"
            required
            minLength={20}
            maxLength={5000}
          />
        </label>
        <label>
          Audience
          <select className={input} name="audience">
            <option>ACTIVE</option>
            <option>DORMANT</option>
            <option>INVITED</option>
            <option>SELECTED</option>
          </select>
        </label>
        <fieldset className="max-h-64 space-y-2 overflow-auto rounded border border-border p-4">
          <legend>Choose recipients for the Selected audience</legend>
          {accounts.map((a) => (
            <label className="flex gap-3" key={String(a.id)}>
              <input type="checkbox" name="selected" value={String(a.id)} />
              <span>
                {String(a.name)} · {String(a.email)} · {String(a.status)}
              </span>
            </label>
          ))}
          <p className="text-sm">
            Up to 100 accounts are shown. Marketing preferences are checked
            before recipients are included.
          </p>
        </fieldset>
        <button className={input}>Save draft and preview recipients</button>
      </ActionForm>
      {campaigns.map((c) => {
        const recipients = c.recipients as string[];
        const rendered = mailLayout({
          branding: brand,
          title: String(c.subject),
          bodyHtml:
            '<p style="white-space:pre-wrap">' +
            escape(String(c.body)) +
            "</p>" +
            mailAction(
              "Open your secure workspace",
              "https://business.jktl.com.ng/affiliates/resources",
            ),
          text: String(c.body),
          category: "marketing",
          promotions: [],
        });
        return (
          <article
            key={String(c.id)}
            className="space-y-3 rounded-xl border border-border p-5"
          >
            <h2>
              {String(c.subject)} · {String(c.status)}
            </h2>
            <p>
              {recipients.length} recipients · {String(c.accepted)} provider
              accepted · {String(c.suppressed)} suppressed ·{" "}
              {String(c.exhausted)} need delivery review
            </p>
            <details>
              <summary>Review exact recipients</summary>
              <p className="break-all">{recipients.join(", ")}</p>
            </details>
            <p className="text-sm text-ink-muted">
              Preview of the approved message. Private preferences links and any
              permitted recipient-specific promotions are added during delivery.
            </p>
            <iframe
              title={"Email preview: " + c.subject}
              className="h-96 w-full rounded border border-border bg-white"
              sandbox=""
              srcDoc={rendered.html}
            />
            {c.status === "DRAFT" && (
              <ActionForm action={confirmAffiliateCampaignAction}>
                <input name="id" type="hidden" value={String(c.id)} />
                <input name="count" type="hidden" value={recipients.length} />
                <label>
                  <input type="checkbox" name="confirm" required />I reviewed
                  the message and exact recipient list
                </label>
                <button className="mt-3 block rounded bg-primary p-3 text-on-primary">
                  Queue approved campaign
                </button>
              </ActionForm>
            )}
          </article>
        );
      })}
    </div>
  );
}
