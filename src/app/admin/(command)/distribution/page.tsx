import Link from "next/link";
import { guardAdminPage } from "@/lib/admin-page-guard";
import { query } from "@/lib/custom/service";
import { requireAdminCapability } from "@/lib/admin-session";
import {
  saveDistributionDraftAction,
  reviewLegacyEnrollmentAction,
} from "@/lib/actions/distribution-actions";
export const dynamic = "force-dynamic";
export default async function Distribution() {
  await guardAdminPage("manage_affiliates");
  const admin = await requireAdminCapability("manage_affiliates");
  let policies: Record<string, unknown>[],
    enrollments: Record<string, unknown>[],
    audit: Record<string, unknown>[];
  try {
    [policies, enrollments, audit] = await Promise.all([
      query("SELECT * FROM distribution_policies ORDER BY created_at DESC"),
      query(
        `SELECT e.*,a.name,a.programme FROM distribution_enrollments e JOIN affiliates a ON a.id=e.affiliate_id ORDER BY e.review_required DESC,e.created_at LIMIT 100`,
      ),
      query(
        "SELECT event,created_at,detail FROM distribution_audit ORDER BY id DESC LIMIT 50",
      ),
    ]);
  } catch {
    return (
      <p role="alert">
        Distribution policy management is unavailable. Apply migration 038 and
        verify database configuration. Existing Affiliate and Partner operations
        remain available.
      </p>
    );
  }
  const input = "w-full rounded-lg border border-border bg-paper p-3";
  return (
    <div className="space-y-8 text-ink">
      <header>
        <h1 className="text-3xl font-semibold">Distribution</h1>
        <p className="mt-3 text-ink-muted">
          Affiliate and Partner policy governance. Proposed policies remain
          draft; current agreements and payout balances are unchanged.
        </p>
        <nav className="mt-4 flex flex-wrap gap-5">
          <Link className="underline" href="/admin/affiliates">
            Affiliate applications, earnings & payouts
          </Link>
          <Link className="underline" href="/admin/partners">
            Partner applications & agreements
          </Link>
        </nav>
      </header>
      <section className="rounded-xl border border-border p-5">
        <h2 className="text-xl font-semibold">Program policy versions</h2>
        <p className="my-3 text-sm">
          Activation is unavailable until payment integration, signed
          acceptance, migration review and coordinated public terms are
          complete.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {policies.map((p) => (
            <article
              key={String(p.id)}
              className="min-w-0 rounded-lg border border-border p-4"
            >
              <h3 className="font-semibold">{String(p.name)}</h3>
              <p>
                {String(p.program)} · {String(p.state)}
              </p>
              <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words text-xs">
                {JSON.stringify(p.terms, null, 2)}
              </pre>
            </article>
          ))}
        </div>
      </section>
      {admin.role === "owner" && (
        <section className="rounded-xl border border-border p-5">
          <h2 className="text-xl font-semibold">Create proposed policy</h2>
          <p className="my-3 text-sm">
            Saving creates a draft only. It does not assign rates to
            participants or change any advertised offer.
          </p>
          <form
            action={saveDistributionDraftAction}
            className="grid max-w-xl gap-4"
          >
            <label>
              Name
              <input
                className={input}
                name="name"
                required
                minLength={5}
                maxLength={160}
              />
            </label>
            <label>
              Program
              <select className={input} name="program">
                <option>AFFILIATE</option>
                <option>PARTNER</option>
              </select>
            </label>
            <label>
              Commission in basis points (1500 = 15%)
              <input
                className={input}
                name="rateBps"
                type="number"
                required
                min={0}
                max={5000}
                defaultValue={1500}
              />
            </label>
            <label>
              Eligible paid service months
              <input
                className={input}
                name="paidMonths"
                type="number"
                required
                min={1}
                max={36}
                defaultValue={12}
              />
            </label>
            <label>
              Review hold in days
              <input
                className={input}
                name="holdDays"
                type="number"
                required
                min={14}
                max={365}
                defaultValue={30}
              />
            </label>
            <button className="rounded-lg bg-primary p-3 text-on-primary">
              Save draft policy
            </button>
          </form>
        </section>
      )}
      <section>
        <h2 className="text-xl font-semibold">Legacy agreement review</h2>
        <p className="my-3 text-sm">
          Snapshots preserve account settings, not proof of signed contracts.
          All imported accounts require review. Reviewing acknowledges the
          snapshot; it never changes earnings or enrolls anyone in new terms.
          Showing at most 100 accounts.
        </p>
        <div className="space-y-3">
          {enrollments.map((e) => (
            <article
              key={String(e.affiliate_id)}
              className="rounded-xl border border-border p-4"
            >
              <h3 className="font-semibold">
                {String(e.name)} · {String(e.programme)}
              </h3>
              <p>
                {e.review_required
                  ? "Requires reconciliation"
                  : "Snapshot reviewed"}
              </p>
              <details>
                <summary>Original account terms</summary>
                <pre className="overflow-auto whitespace-pre-wrap break-words text-xs">
                  {JSON.stringify(e.legacy_terms, null, 2)}
                </pre>
              </details>
              {admin.role === "owner" && Boolean(e.review_required) && (
                <form
                  action={reviewLegacyEnrollmentAction}
                  className="mt-3 flex flex-wrap gap-3"
                >
                  <input
                    type="hidden"
                    name="id"
                    value={String(e.affiliate_id)}
                  />
                  <label className="grow">
                    Reconciliation note
                    <input
                      className={input}
                      name="note"
                      required
                      minLength={10}
                      maxLength={2000}
                    />
                  </label>
                  <button className="rounded-lg border border-border p-3">
                    Mark snapshot reviewed
                  </button>
                </form>
              )}
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Recent governance audit</h2>
        <ul className="space-y-2">
          {audit.map((a, i) => (
            <li key={i} className="rounded border border-border p-3 text-sm">
              {String(a.event)} ·{" "}
              {new Date(String(a.created_at)).toLocaleString("en-NG", {
                timeZone: "Africa/Lagos",
              })}
              <pre className="whitespace-pre-wrap break-words">
                {JSON.stringify(a.detail)}
              </pre>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
