import { requireAffiliateSession } from "@/lib/affiliate-session";
import { query } from "@/lib/custom/service";
import { AffiliateOverview } from "@/components/distribution/affiliate-overview";
import Link from "next/link";
import { BookOpen, ExternalLink, Gift } from "lucide-react";
const EARNING_LABEL: Record<string, string> = {
  signup: "Signup bonus",
  subscription: "Subscription bonus",
  recurring: "Monthly commission",
  welcome: "Welcome bonus",
  commission: "Commission",
};

import { PageHeader } from "@/components/app/page-header";
import { StatTile } from "@/components/app/stat-tile";
import { CopyReferralLink } from "@/components/affiliates/copy-referral-link";
import { ChangePasswordForm } from "@/components/affiliates/change-password-form";
import { AffiliatePayoutSection } from "@/components/affiliates/payout-section";
import { getAffiliateDashboardAction } from "@/lib/actions/affiliate-actions";
import { formatKobo, formatRelativeDay } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  active: "Subscribed",
  past_due: "Payment overdue",
  canceled: "Canceled",
  inactive: "Not subscribed yet",
};

export default async function AffiliateDashboardPage() {
  const result = await getAffiliateDashboardAction();
  if (!result.ok) {
    return <p className="text-sm text-danger">{result.error}</p>;
  }
  const data = result.data;
  if (data.commissionModel === "policy") return <AffiliateOverview />;
  const identity = await requireAffiliateSession();
  const visits =
    (
      await query(
        "SELECT qualified_visit_count FROM affiliate_activity WHERE affiliate_id=$1",
        [identity.id],
      )
    )[0]?.qualified_visit_count || 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Welcome, ${data.name.split(" ")[0]}`} />
      <p className="-mt-2 text-sm text-ink-muted">
        Share your link — you earn{" "}
        <strong className="font-semibold text-ink">
          {formatKobo(data.terms.signupBonusKobo)}
        </strong>{" "}
        when a business signs up,{" "}
        <strong className="font-semibold text-ink">
          {formatKobo(data.terms.subscriptionBonusKobo)}
        </strong>{" "}
        when they subscribe, then{" "}
        <strong className="font-semibold text-ink">
          {formatKobo(data.terms.recurringMonthlyKobo)}
        </strong>{" "}
        every month they stay subscribed.
      </p>

      <CopyReferralLink link={data.referralLink} />

      <a
        href={data.referralLink}
        target="_blank"
        rel="noreferrer"
        className="-mt-3 flex items-center gap-1.5 self-start text-xs font-medium text-primary"
      >
        <ExternalLink className="size-3.5" /> Not sure what you&apos;re
        promoting? Open your link and see it yourself
      </a>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <Gift className="size-4 shrink-0 text-primary" />
          <p className="text-sm font-semibold text-ink">
            {formatKobo(data.firstYearValueKobo)} from one referral in the first
            year
          </p>
        </div>
        <ol className="mt-3 flex flex-col gap-2">
          {[
            {
              amount: data.terms.signupBonusKobo,
              label: "when they create an account",
              note: "held until they subscribe",
            },
            {
              amount: data.terms.subscriptionBonusKobo,
              label: "when they subscribe",
              note: "releases the signup bonus too",
            },
            {
              amount: data.terms.recurringMonthlyKobo,
              label: "every month they stay subscribed",
              note: "for as long as they stay",
            },
          ].map((step) => (
            <li key={step.label} className="flex items-baseline gap-2 text-sm">
              <span className="font-display font-semibold text-ink">
                {formatKobo(step.amount)}
              </span>
              <span className="text-ink-muted">{step.label}</span>
              <span className="text-xs text-ink-faint">· {step.note}</span>
            </li>
          ))}
        </ol>
        {data.pendingKobo > 0 ? (
          <p className="mt-3 rounded-xl bg-paper px-3 py-2 text-xs text-ink-muted">
            <strong className="font-semibold text-ink">
              {formatKobo(data.pendingKobo)} is pending.
            </strong>{" "}
            The signup bonus is shown as soon as your referral creates an
            account, but it becomes withdrawable when they subscribe — that is
            what stops the bonus being earned by free accounts.
          </p>
        ) : null}
      </div>

      <Link
        href={
          data.programme === "partner"
            ? "/partners/playbook"
            : "/affiliates/playbook"
        }
        className="flex items-center justify-between rounded-2xl border border-border bg-primary-soft p-4 text-primary"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="size-4" /> New here? Read the affiliate playbook
        </span>
        <span className="text-xs font-medium">
          Content ideas + a 7-day plan →
        </span>
      </Link>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Valid referral visits"
          value={Number(visits).toLocaleString()}
        />
        <StatTile label="Account status" value={identity.status} />
        <StatTile
          label="Paying customers"
          value={String(
            data.referredBusinesses.filter(
              (b) => b.subscriptionStatus === "active",
            ).length,
          )}
        />
        <StatTile
          label="Referred businesses"
          value={data.referredBusinesses.length.toLocaleString()}
        />
        <StatTile
          label="Total earned"
          value={formatKobo(data.totalEarnedKobo)}
          rule="info"
        />
        <StatTile
          label="Paid out"
          value={formatKobo(data.totalPaidOutKobo)}
          rule="accent"
        />
        <StatTile
          label="Withdrawable now"
          value={formatKobo(data.balanceKobo)}
          rule="primary"
        />
        <StatTile
          label="Pending (held)"
          value={formatKobo(data.pendingKobo)}
          rule="accent"
        />
        <StatTile
          label={`Recurring (${data.referredBusinesses.length} referral${data.referredBusinesses.length === 1 ? "" : "s"})`}
          value={formatKobo(
            data.terms.recurringMonthlyKobo * data.referredBusinesses.length,
          )}
          rule="info"
        />
      </div>

      {/* Reporting. Answers the three questions a partner actually has, in
          order: what am I earning every month, is my effort working, and what is
          one referral worth. */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-base font-semibold text-ink">
          Your numbers
        </h2>

        <div className="rounded-2xl border border-border bg-paper p-4">
          <p className="text-xs font-medium text-ink-muted">
            Recurring, every month
          </p>
          <p className="font-display text-2xl font-semibold text-ink">
            {formatKobo(data.report.runRate.monthlyKobo)}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {data.report.runRate.payingReferrals} paying referral
            {data.report.runRate.payingReferrals === 1 ? "" : "s"} ×{" "}
            {formatKobo(data.terms.recurringMonthlyKobo)}
            {data.report.runRate.changePct !== 0 ? (
              <span
                className={
                  data.report.runRate.changePct > 0
                    ? "text-primary"
                    : "text-danger"
                }
              >
                {" "}
                · {data.report.runRate.changePct > 0 ? "+" : ""}
                {data.report.runRate.changePct}% on last month
              </span>
            ) : null}
          </p>
          <p className="mt-2 text-xs text-ink-faint">
            {formatKobo(data.report.projectedTwelveMonthsKobo)} over the next
            twelve months if everyone stays — a projection, not a promise.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Signed up"
            value={data.report.funnel.signedUp.toLocaleString()}
            rule="info"
          />
          <StatTile
            label="Subscribed"
            value={data.report.funnel.subscribed.toLocaleString()}
            rule="primary"
          />
          <StatTile
            label="Conversion"
            value={`${data.report.funnel.conversionPct}%`}
            rule="accent"
          />
          <StatTile
            label="Avg per referral"
            value={formatKobo(data.report.value.averageKobo)}
            rule="info"
          />
        </div>

        <p className="rounded-xl bg-surface px-3 py-2.5 text-[13px] text-ink-muted">
          {data.report.funnel.headline}
        </p>

        {/* Where the money came from, by tier. */}
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-surface text-[11px] uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-3 py-2 font-semibold">Tier</th>
                <th className="px-3 py-2 text-right font-semibold">
                  Earned so far
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                {
                  label: "Signup bonus",
                  amount: data.report.byKind.signupKobo,
                },
                {
                  label: "Subscription bonus",
                  amount: data.report.byKind.subscriptionKobo,
                },
                {
                  label: "Monthly commission",
                  amount: data.report.byKind.recurringKobo,
                },
                {
                  label: "Earlier programme",
                  amount: data.report.byKind.legacyKobo,
                },
              ]
                .filter((row) => row.amount > 0)
                .map((row) => (
                  <tr key={row.label}>
                    <td className="px-3 py-2 text-ink-muted">{row.label}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-ink">
                      {formatKobo(row.amount)}
                    </td>
                  </tr>
                ))}
              <tr className="bg-surface">
                <td className="px-3 py-2 font-semibold text-ink">Total</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink">
                  {formatKobo(data.report.byKind.totalKobo)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {data.report.value.bestBusinessName ? (
          <p className="text-xs text-ink-muted">
            Your best referral so far is{" "}
            <span className="font-medium text-ink">
              {data.report.value.bestBusinessName}
            </span>{" "}
            at {formatKobo(data.report.value.bestKobo)}. One referral is
            modelled at {formatKobo(data.report.value.modelledFirstYearKobo)} in
            year one.
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold text-ink">
          Your referrals
        </h2>
        {data.referredBusinesses.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Nobody has signed up through your link yet.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border">
            {data.referredBusinesses.map((r) => (
              <div
                key={r.organizationId}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-ink">
                    {r.displayName}
                  </div>
                  <div className="text-xs text-ink-muted">
                    Signed up {formatRelativeDay(r.referredAt)}
                  </div>
                </div>
                <span className="text-xs font-medium text-ink-muted">
                  {STATUS_LABEL[r.subscriptionStatus] ?? r.subscriptionStatus}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold text-ink">
          Recent earnings
        </h2>
        {data.earnings.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Nothing yet — commission is earned when a referred business&apos;s
            subscription payment goes through.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border">
            {data.earnings.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-ink">
                    {EARNING_LABEL[e.kind] ?? "Commission"}
                    <span className="ml-1.5 font-normal text-ink-muted">
                      · {e.businessName}
                    </span>
                  </div>
                  <div className="text-xs text-ink-muted">
                    {e.kind === "recurring" && e.periodKey
                      ? `${e.periodKey} · `
                      : ""}
                    {e.status === "pending" ? (
                      <span className="text-accent-strong">
                        Pending until they subscribe ·{" "}
                      </span>
                    ) : null}
                    {formatRelativeDay(e.createdAt)}
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums text-ink">
                  {formatKobo(e.commissionKobo)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold text-ink">
          Payout history
        </h2>
        {data.payouts.length === 0 ? (
          <p className="text-sm text-ink-muted">No payouts recorded yet.</p>
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border">
            {data.payouts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-ink">
                    {p.note || "Payout"}
                  </div>
                  <div className="text-xs text-ink-muted">
                    {formatRelativeDay(p.createdAt)}
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums text-ink">
                  {formatKobo(p.amountKobo)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <AffiliatePayoutSection
        bankCode={data.bankCode}
        bankName={data.bankName}
        accountNumber={data.accountNumber}
        accountName={data.accountName}
        bankVerifiedAt={data.bankVerifiedAt}
        balanceKobo={data.balanceKobo}
        payoutWindowOpen={data.payoutWindowOpen}
        currentPayoutRequest={data.currentPayoutRequest}
      />

      <ChangePasswordForm />
    </div>
  );
}
