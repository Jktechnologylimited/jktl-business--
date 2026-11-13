
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { guardAdminPage } from "@/lib/admin-page-guard";
import { query } from "@/lib/custom/service";
import { ActionForm } from "@/components/distribution/action-form";
import { saveCustomerCareAction } from "@/lib/actions/customer-care-actions";
import { CARE_STEPS, CARE_STATUS } from "@/lib/customer-care/model";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await guardAdminPage("manage_support");
  if (
    !(await query("SELECT to_regclass('public.customer_care') present"))[0]
      ?.present
  )
    return (
      <p>Install the latest customer-care migration to view this checklist.</p>
    );
  const params = await searchParams,
    rows = await query(
      `SELECT c.*,b.display_name,b.published,b.subdomain,b.website_template_id,(COALESCE(trim(b.logo_url),'')<>'') profile_logo,(COALESCE(trim(b.phone),'')<>'' AND COALESCE(trim(b.email),'')<>'') profile_contacts,(COALESCE(trim(b.custom_domain),'')<>'') custom_domain,(SELECT count(*)::int FROM support_cases s WHERE s.organization_id=c.organization_id AND s.status<>'RESOLVED') open_cases FROM customer_care c JOIN business_profiles b ON b.organization_id=c.organization_id WHERE($1='' OR b.display_name ILIKE '%'||$1||'%') AND($2='' OR c.status=$2) ORDER BY CASE WHEN c.follow_up_on IS NULL THEN 0 ELSE 1 END,c.follow_up_on,c.created_at`,
      [(params.q || "").slice(0, 120), params.status || ""],
    ),
    team = await query(
      "SELECT id,name FROM admin_users WHERE role IN('owner','support') AND disabled_at IS NULL AND staff_revoked_at IS NULL ORDER BY name",
    ),
    summary = (
      await query(
        "SELECT count(*)::int total,count(*) FILTER(WHERE status='COMPLETE')::int complete,count(*) FILTER(WHERE assigned_to IS NULL)::int unassigned,count(*) FILTER(WHERE status<>'COMPLETE' AND follow_up_on<=(now() AT TIME ZONE 'Africa/Lagos')::date)::int due FROM customer_care",
      )
    )[0];
  const card = "rounded-2xl border border-border bg-paper p-5",
    input = "w-full rounded-lg border border-border bg-paper p-3 text-ink",
    button = "rounded-lg border border-border px-4 py-2 text-sm font-semibold";
  return (
    <section className="space-y-6 text-ink">
      <header>
        <Link href="/admin/support" className="text-sm text-blue-600 underline">
          Support inbox
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Founding customer care</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          Hands-on setup and priority follow-up for the selected founding
          accounts. Help each business reach a useful, approved, live website.
          These checklist updates record team work; website edits and publishing
          still use the existing customer-consent workflow.
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Founding accounts", summary.total],
          ["Handed over", summary.complete],
          ["Needs assignment", summary.unassigned],
          ["Follow-up due", summary.due],
        ].map(([label, value]) => (
          <div className={card} key={String(label)}>
            <p className="text-sm">{label}</p>
            <b className="text-2xl">{value}</b>
          </div>
        ))}
      </div>
      <section className={card}>
        <h2 className="font-semibold">
          Work through the customer’s needs first
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          Start with their brief, logo, real contact details and approved
          content. Agree a design, test it on phone and desktop, then show the
          owner how to manage it. A free JKTL subdomain is a valid launch
          option; discuss domains or business email where useful. Ask for honest
          feedback after handover. Support never depends on a positive review or
          permission to use the business as a case study.
        </p>
        <p className="mt-3 text-sm">
          Profile indicators below describe JKTL Business records. A separate
          custom website may already contain content that still needs to be
          checked with the customer.
        </p>
      </section>
      <form className="flex flex-wrap gap-3">
        <input
          className={input + " sm:max-w-xs"}
          name="q"
          defaultValue={params.q}
          placeholder="Search founding accounts"
          aria-label="Search founding accounts"
        />
        <select
          className={input + " sm:max-w-xs"}
          name="status"
          defaultValue={params.status || ""}
          aria-label="Care status"
        >
          <option value="">All stages</option>
          {Object.entries(CARE_STATUS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button className={button}>Filter</button>
      </form>
      {!rows.length && <p>No matching founding accounts.</p>}
      {rows.map((c) => (
        <article
          className={card + " space-y-4"}
          key={String(c.organization_id)}
        >
          <header>
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              Founding customer · Priority support
            </span>
            <h2 className="mt-2 text-xl font-semibold">
              {String(c.display_name)}
            </h2>
            <p className="mt-2 text-xs text-ink-muted">
              Profile logo: {c.profile_logo ? "Recorded" : "Needed"} · Contact
              details: {c.profile_contacts ? "Recorded" : "Needed"} · Template:{" "}
              {c.website_template_id ? "Selected" : "Not selected"} · Published
              on JKTL: {c.published ? "Yes" : "Not yet"} · Open cases:{" "}
              {Number(c.open_cases)}
            </p>
          </header>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link
              className="text-blue-600 underline"
              href={"/admin/support?organization=" + c.organization_id}
            >
              Open this business’s support inbox
            </Link>
            {c.published && /^[a-z0-9-]+$/.test(String(c.subdomain)) && (
              <a
                className="text-blue-600 underline"
                href={"https://" + c.subdomain + ".jktl.com.ng"}
                target="_blank"
                rel="noopener noreferrer"
              >
                Review live JKTL website <ArrowUpRight size={16} className="inline-block align-middle" aria-hidden="true" />
              </a>
            )}
          </div>
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              Setup checklist & follow-up ·{" "}
              {CARE_STATUS[c.status as keyof typeof CARE_STATUS]}
            </summary>
            <ActionForm
              action={saveCustomerCareAction}
              className="mt-4 space-y-4"
              success="Customer care plan updated."
            >
              <input
                type="hidden"
                name="organization"
                value={String(c.organization_id)}
              />
              <input type="hidden" name="revision" value={Number(c.revision)} />
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  Stage
                  <select
                    className={input}
                    name="status"
                    defaultValue={String(c.status)}
                  >
                    {Object.entries(CARE_STATUS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Responsible teammate
                  <select
                    className={input}
                    name="assigned"
                    defaultValue={String(c.assigned_to || "")}
                  >
                    <option value="">Choose a teammate</option>
                    {team.map((t) => (
                      <option key={String(t.id)} value={String(t.id)}>
                        {String(t.name)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Next follow-up
                  <input
                    className={input}
                    type="date"
                    name="follow"
                    defaultValue={String(c.follow_up_on || "").slice(0, 10)}
                  />
                </label>
              </div>
              <fieldset className="space-y-3">
                <legend className="mb-3 text-sm font-semibold">
                  Check only work the team has verified
                </legend>
                {Object.entries(CARE_STEPS).map(([key, label]) => (
                  <label key={key} className="flex items-start gap-3 text-sm">
                    <input
                      className="mt-1"
                      type="checkbox"
                      name="steps"
                      value={key}
                      defaultChecked={(c.checked_steps as string[]).includes(
                        key,
                      )}
                    />
                    <span>
                      {label}
                      {key === "feedback" ? " (optional)" : ""}
                    </span>
                  </label>
                ))}
              </fieldset>
              <label className="block text-sm">
                Team notes
                <textarea
                  className={input + " mt-2"}
                  name="notes"
                  maxLength={2000}
                  rows={3}
                  defaultValue={String(c.notes || "")}
                  placeholder="What the customer needs, what is blocked, and the agreed next step. Do not record passwords or payment credentials."
                />
              </label>
              <button className={button}>Save care progress</button>
            </ActionForm>
          </details>
        </article>
      ))}
    </section>
  );
}
