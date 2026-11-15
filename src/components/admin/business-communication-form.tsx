import { ActionForm } from "@/components/distribution/action-form";
import { saveBusinessCommunicationAction } from "@/lib/actions/renewal-actions";

export function BusinessCommunicationForm({ profile }: { profile: Record<string, unknown> }) {
  const input = "mt-1 block w-full rounded-lg border border-border bg-paper p-3 text-ink";
  return <section className="rounded-xl border border-border bg-paper p-5" id="business-contact">
    <h3 className="text-xl font-semibold">Business communication details</h3>
    <p className="my-3 text-sm text-ink-muted">For {String(profile.organization_name)}. These details are used for renewal communication. They do not change the login, public website or paid access.</p>
    <p className="mb-4 break-all text-sm">Existing sign-in email: {String(profile.owner_email || "No active owner email")}</p>
    <ActionForm action={saveBusinessCommunicationAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="organization" value={String(profile.organization_id)} />
      <input type="hidden" name="revision" value={Number(profile.revision || 0)} />
      <label>Business name for emails<input name="businessName" className={input} maxLength={200} defaultValue={String(profile.business_name || profile.organization_name)} /></label>
      <label>Contact person<input name="contactName" className={input} maxLength={200} defaultValue={String(profile.contact_name || "")} /></label>
      <label>Primary billing email<input type="email" name="billingEmail" className={input} maxLength={254} defaultValue={String(profile.billing_email || "")} /><span className="text-xs text-ink-muted">Leave blank to use the active account owner. A service-specific override takes priority.</span></label>
      <label>Contact phone<input type="tel" name="phone" className={input} maxLength={50} defaultValue={String(profile.phone || "")} /></label>
      <label>Additional contact emails<textarea name="additionalEmails" className={input} rows={3} maxLength={1300} defaultValue={((profile.additional_emails || []) as string[]).join("\n")} /><span className="text-xs text-ink-muted">One per line, up to five. Saved for team follow-up; not automatically CC’d.</span></label>
      <label>Client relationship<select name="clientStatus" className={input} defaultValue={String(profile.client_status || "ACTIVE")}><option value="ACTIVE">Active client</option><option value="PAUSED">Paused — pause renewal emails</option><option value="CLOSED">Closed — stop renewal emails</option></select><span className="text-xs text-ink-muted">Separate from the underlying product subscription and customer login.</span></label>
      <label className="sm:col-span-2">Internal communication notes<textarea name="notes" className={input} rows={3} maxLength={2000} defaultValue={String(profile.notes || "")} /></label>
      <button className="rounded-lg border border-border px-4 py-2 font-semibold">Save business communication details</button>
    </ActionForm>
  </section>;
}
