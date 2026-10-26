import Link from "next/link";
import { notFound } from "next/navigation";
import { guardAdminPage } from "@/lib/admin-page-guard";
import { growth, query } from "@/lib/growth/service";
import { growthModules } from "@/lib/growth/modules";
import { ActionForm } from "@/components/distribution/action-form";
import { GrowthContent } from "@/components/admin/growth-content";
import {
  createGrowthLeadAction,
  updateGrowthLeadAction,
  reviewGrowthApplicationAction,
  saveGrowthResourceAction,
} from "@/lib/actions/growth-actions";
import { assignGrowthLeadAction } from "@/lib/actions/growth-staff-actions";
export const dynamic = "force-dynamic";
const input = "block w-full rounded-lg border border-border bg-paper p-3";
export default async function Page({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const m = growthModules.find((m) => m.slug === module);
  if (!m) notFound();
  await guardAdminPage(m.permission);
  const a = await growth(m.permission);
  if (module === "content") return <GrowthContent />;
  if (module === "leads") {
    const leads = await query(
      "SELECT id,business_name,email,phone,city,status,assigned_staff_id FROM prospects WHERE assigned_staff_id=$1 OR $2 ORDER BY created_at DESC LIMIT 100",
      [a.id, a.role === "owner"],
    );
    const staff =
      a.role === "owner"
        ? await query(
            "SELECT id,name FROM admin_users WHERE role='growth_gaming_lead' AND disabled_at IS NULL AND staff_revoked_at IS NULL",
          )
        : [];
    return (
      <div className="space-y-5 text-ink">
        <h2 className="text-2xl font-semibold">Assigned acquisition leads</h2>
        <p>
          Only assigned contacts are available to staff. Outreach notes record
          work; they do not send messages or manufacture paid conversions.
        </p>
        <ActionForm
          action={createGrowthLeadAction}
          className="grid gap-3 rounded-xl border border-border p-5"
        >
          <h3 className="font-semibold">Add a lead</h3>
          {[
            ["name", "Business name"],
            ["email", "Email (optional)"],
            ["phone", "Phone (optional)"],
            ["city", "City (optional)"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                name={key}
                required={key === "name"}
                type={key === "email" ? "email" : "text"}
                maxLength={key === "email" ? 254 : key === "phone" ? 40 : 160}
                className={input}
              />
            </label>
          ))}
          <button className="rounded-lg bg-primary p-3 text-on-primary">
            Add assigned lead
          </button>
        </ActionForm>
        {leads.map((l) => (
          <article
            className="space-y-3 rounded-xl border border-border p-5"
            key={String(l.id)}
          >
            <h3 className="font-semibold">
              {String(l.business_name)} · {String(l.status)}
            </h3>
            <p>
              {String(l.city)} · {String(l.email)} · {String(l.phone)}
            </p>
            <ActionForm action={updateGrowthLeadAction} className="space-y-3">
              <input type="hidden" name="id" value={String(l.id)} />
              <label>
                Outreach status
                <select
                  name="status"
                  className={input}
                  defaultValue={String(l.status)}
                >
                  {["new", "qualified", "contacted", "replied", "rejected"].map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Activity note
                <textarea
                  name="note"
                  required
                  maxLength={2000}
                  className={input}
                />
              </label>
              <button className="rounded border border-border p-3">
                Record outreach
              </button>
            </ActionForm>
            {a.role === "owner" && (
              <ActionForm action={assignGrowthLeadAction} className="space-y-3">
                <input type="hidden" name="lead" value={String(l.id)} />
                <label>
                  Assign staff
                  <select name="staff" className={input}>
                    {staff.map((s) => (
                      <option key={String(s.id)} value={String(s.id)}>
                        {String(s.name)}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="rounded border border-border p-3">
                  Assign lead
                </button>
              </ActionForm>
            )}
          </article>
        ))}
      </div>
    );
  }
  if (module === "applications") {
    const apps = await query(
      "SELECT id,name,email,programme,application_stage,application_data,application_note FROM affiliates WHERE status='pending' ORDER BY created_at DESC LIMIT 100",
    );
    const reviews = await query(
      "SELECT r.affiliate_id,r.recommendation,r.note,r.applicant_message,r.created_at FROM growth_application_reviews r WHERE reviewer_id=$1 OR $2 ORDER BY created_at DESC LIMIT 100",
      [a.id, a.role === "owner"],
    );
    const fields = [
      "company",
      "category",
      "services",
      "clients",
      "products",
      "monthlyReferrals",
      "partnership",
      "phone",
      "country",
      "platform",
      "url",
      "audience",
      "promotion",
    ];
    return (
      <div className="space-y-5 text-ink">
        <h2 className="text-2xl font-semibold">
          Affiliate & Partner applications
        </h2>
        <p>
          Recommendations do not approve accounts, change financial agreements
          or release payouts. Applicant messages are queued through JKTL’s
          existing transactional email service.
        </p>
        {apps.map((app) => (
          <article
            key={String(app.id)}
            className="space-y-3 rounded-xl border border-border p-5"
          >
            <h3 className="font-semibold">
              {String(app.name)} · {String(app.programme)}
            </h3>
            <p>
              {String(app.email)} · {String(app.application_stage)}
            </p>
            <p className="whitespace-pre-wrap">
              {String(app.application_note || "")}
            </p>
            <details>
              <summary>Application details</summary>
              {fields
                .filter(
                  (f) => (app.application_data as Record<string, unknown>)?.[f],
                )
                .map((f) => (
                  <p key={f} className="my-2 break-words">
                    {f}:{" "}
                    {String(
                      (app.application_data as Record<string, unknown>)[f],
                    )}
                  </p>
                ))}
            </details>
            <ActionForm
              action={reviewGrowthApplicationAction}
              className="space-y-3"
            >
              <input type="hidden" name="id" value={String(app.id)} />
              <label>
                Recommendation
                <select className={input} name="recommendation">
                  <option value="REVIEW">Needs review</option>
                  <option value="APPROVE">Recommend approval</option>
                  <option value="REJECT">Recommend rejection</option>
                </select>
              </label>
              <label>
                Internal review note
                <textarea
                  name="note"
                  required
                  maxLength={2000}
                  className={input}
                />
              </label>
              <label>
                Message to applicant (optional; sent by transactional email)
                <textarea name="message" maxLength={2000} className={input} />
              </label>
              <button className="rounded-lg bg-primary p-3 text-on-primary">
                Save recommendation & queue message
              </button>
            </ActionForm>
          </article>
        ))}
        <h3 className="text-xl font-semibold">Your review history</h3>
        {reviews.map((r, i) => (
          <p key={i} className="rounded border border-border p-3">
            {String(r.recommendation)} · {String(r.created_at)} ·{" "}
            {String(r.note)}
          </p>
        ))}
      </div>
    );
  }
  if (module === "resources") {
    const resources = await query(
      "SELECT title,description,url,enabled FROM distribution_assets WHERE enabled=true OR created_by=$1 ORDER BY created_at DESC LIMIT 100",
      [a.id],
    );
    return (
      <div className="space-y-5 text-ink">
        <h2 className="text-2xl font-semibold">
          Approved brand & programme resources
        </h2>
        <p>
          Use approved JKTL assets. New resources remain hidden until an Owner
          reviews and publishes them in Distribution → Resources.
        </p>
        <ActionForm
          action={saveGrowthResourceAction}
          className="space-y-3 rounded-xl border border-border p-5"
        >
          {[
            ["title", "Title"],
            ["description", "Description"],
            ["url", "HTTPS asset URL"],
          ].map(([k, l]) => (
            <label className="block" key={k}>
              {l}
              <input
                name={k}
                required
                type={k === "url" ? "url" : "text"}
                className={input}
              />
            </label>
          ))}
          <label>
            Audience
            <select name="audience" className={input}>
              <option>BOTH</option>
              <option>AFFILIATE</option>
              <option>PARTNER</option>
            </select>
          </label>
          <button className="rounded-lg bg-primary p-3 text-on-primary">
            Submit resource for approval
          </button>
        </ActionForm>
        {resources.map((r, i) => (
          <article key={i} className="rounded-xl border border-border p-5">
            <h3 className="font-semibold">
              {String(r.title)} · {r.enabled ? "Approved" : "Awaiting approval"}
            </h3>
            <p>{String(r.description)}</p>
            <a
              className="underline"
              href={String(r.url)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open resource
            </a>
          </article>
        ))}
      </div>
    );
  }
  if (module === "games") {
    const counts = (
      await query(
        "SELECT count(*)::int AS saved_players,count(*) FILTER(WHERE updated_at>now()-interval '7 days')::int AS recent_saves FROM tycoon_saves",
      )
    )[0];
    return (
      <div className="space-y-6 text-ink">
        <h2 className="text-2xl font-semibold">Approved JKTL Games</h2>
        <article className="rounded-xl border border-border p-5">
          <h3 className="font-semibold">JKTL Business Tycoon</h3>
          <p>
            {String(counts?.saved_players || 0)} accounts with cloud saves ·{" "}
            {String(counts?.recent_saves || 0)} saves updated in the last 7
            days. Guest play and session duration are not measured here.
          </p>
          <Link className="underline" href="/play/tycoon">
            Test Tycoon
          </Link>
        </article>
        <article className="rounded-xl border border-border p-5">
          <h3 className="font-semibold">JKTL Fantasy</h3>
          <a
            className="underline"
            href="https://games.jktl.com.ng"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open game experience
          </a>
          <p className="mt-3">
            The separate Fantasy repository has account sign-on but no connected
            staff content or analytics API. Descriptions, settings, scores,
            leaderboards, results and rewards cannot be changed here. Source
            development requires separately assigned GitHub access.
          </p>
        </article>
        <GrowthContent category="games" />
      </div>
    );
  }
  if (module === "community") {
    const reviews = await query(
      "SELECT quote,display_name,company,rating FROM business_reviews WHERE status='PUBLISHED' AND public_consent=true ORDER BY moderated_at DESC LIMIT 30",
    );
    return (
      <div className="space-y-5 text-ink">
        <h2 className="text-2xl font-semibold">Public community feedback</h2>
        <p>
          Only consented, published customer reviews appear here. Private
          conversations and unpublished feedback remain restricted.
        </p>
        {!reviews.length && <p>No published feedback yet.</p>}
        {reviews.map((r, i) => (
          <blockquote className="rounded-xl border border-border p-5" key={i}>
            <p>{String(r.quote)}</p>
            <footer className="mt-2 text-sm">
              {String(r.display_name)} · {String(r.company)} ·{" "}
              {String(r.rating)}/5
            </footer>
          </blockquote>
        ))}
        <GrowthContent category="community" />
      </div>
    );
  }
  if (module === "analytics") {
    const rows = await query(
      "SELECT a.programme,count(DISTINCT a.id)::int participants,count(DISTINCT r.organization_id)::int referred_signups,count(DISTINCT p.organization_id)::int paying_conversions FROM affiliates a LEFT JOIN affiliate_referrals r ON r.affiliate_id=a.id LEFT JOIN website_plan_payments p ON p.organization_id=r.organization_id GROUP BY a.programme",
    );
    const commission = await query(
      "SELECT a.programme,COALESCE(sum(l.amount_kobo) FILTER(WHERE l.status NOT IN('REVERSED','REJECTED')),0) AS commission_kobo FROM affiliates a LEFT JOIN distribution_ledger l ON l.affiliate_id=a.id GROUP BY a.programme",
    );
    const leads = (
      await query(
        "SELECT count(*)::int total,count(*) FILTER(WHERE EXISTS(SELECT 1 FROM website_plan_payments p WHERE p.organization_id=prospects.site_organization_id))::int paying FROM prospects WHERE assigned_staff_id=$1 OR $2",
        [a.id, a.role === "owner"],
      )
    )[0];
    return (
      <div className="space-y-5 text-ink">
        <h2 className="text-2xl font-semibold">Growth analytics</h2>
        <p>
          Aggregates only. Paying conversions reflect recorded verified website
          subscriptions, not clicks or lead-status labels. Commission totals
          show the new-policy ledger before separate refund/debt adjustments;
          they are not payable balances.
        </p>
        {rows.map((r) => (
          <article
            key={String(r.programme)}
            className="rounded-xl border border-border p-5"
          >
            <h3 className="font-semibold">{String(r.programme)}</h3>
            <p>
              {String(r.participants)} participants ·{" "}
              {String(r.referred_signups)} referred signups ·{" "}
              {String(r.paying_conversions)} paying organizations
            </p>
            <p>
              Recorded commission: ₦
              {(
                Number(
                  commission.find((c) => c.programme === r.programme)
                    ?.commission_kobo || 0,
                ) / 100
              ).toLocaleString("en-NG")}
            </p>
          </article>
        ))}
        <p>
          Your assigned lead pool: {String(leads?.total || 0)} ·{" "}
          {String(leads?.paying || 0)} with verified website payments.
        </p>
        <p className="text-sm text-ink-muted">
          Campaign-level click attribution, social engagement, acquisition cost
          and remote Fantasy analytics have no connected data source. UTM links
          are available in content drafts; no conversion is attributed to a
          campaign by inference.
        </p>
      </div>
    );
  }
  return (
    <section className="space-y-4 text-ink">
      <h2 className="text-2xl font-semibold">Support & collaboration</h2>
      <p>
        Use your existing Business support inbox to request product guidance,
        campaign assistance, game deployment help, report bugs or escalate
        programme concerns. The assistant can answer first and route to
        authorized human staff. You can read your own cases and replies there;
        this role does not grant access to other customers’ conversations.
      </p>
      <Link
        className="inline-block rounded-lg bg-primary p-3 text-on-primary"
        href="/business/help"
      >
        Open my support inbox
      </Link>
      <Link className="ml-3 inline-block underline" href="/help">
        Read JKTL guides
      </Link>
      <p>
        Game source-code access is assigned through GitHub. Production tokens
        and deployment secrets are never displayed in this workspace.
      </p>
    </section>
  );
}
