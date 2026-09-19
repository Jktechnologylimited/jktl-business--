import Link from "next/link";
import { BookOpen, ExternalLink, Gift } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatTile } from "@/components/app/stat-tile";
import { CopyReferralLink } from "@/components/affiliates/copy-referral-link";
import { ChangePasswordForm } from "@/components/affiliates/change-password-form";
import { AffiliatePayoutSection } from "@/components/affiliates/payout-section";
import { getAffiliateDashboardAction } from "@/lib/actions/affiliate-actions";
import { WELCOME_BONUS_KOBO } from "@/lib/db/affiliates";
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Welcome, ${data.name.split(" ")[0]}`} />
      <p className="-mt-2 text-sm text-ink-muted">
        Share your link — you earn {(data.commissionBps / 100).toString()}% of the Website & Hosting subscription fee
        for every business that signs up through it, for as long as they stay subscribed.
      </p>

      <CopyReferralLink link={data.referralLink} />

      <a
        href={data.referralLink}
        target="_blank"
        rel="noreferrer"
        className="-mt-3 flex items-center gap-1.5 self-start text-xs font-medium text-primary"
      >
        <ExternalLink className="size-3.5" /> Not sure what you&apos;re promoting? Open your link and see it yourself
      </a>

      {!data.welcomeBonusClaimedAt ? (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
          <Gift className="size-5 shrink-0 text-primary" />
          <p className="text-sm text-ink-muted">
            <span className="font-semibold text-ink">{formatKobo(WELCOME_BONUS_KOBO)} welcome bonus</span> — unlocked automatically the
            moment your first referred business upgrades to a paid subscription. No extra step needed.
          </p>
        </div>
      ) : null}

      <Link
        href="/affiliates/playbook"
        className="flex items-center justify-between rounded-2xl border border-border bg-primary-soft p-4 text-primary"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="size-4" /> New here? Read the affiliate playbook
        </span>
        <span className="text-xs font-medium">Content ideas + a 7-day plan →</span>
      </Link>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Referred businesses" value={data.referredBusinesses.length.toLocaleString()} />
        <StatTile label="Total earned" value={formatKobo(data.totalEarnedKobo)} rule="info" />
        <StatTile label="Paid out" value={formatKobo(data.totalPaidOutKobo)} rule="accent" />
        <StatTile label="Balance owing to you" value={formatKobo(data.balanceKobo)} rule="primary" />
      </div>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold text-ink">Your referrals</h2>
        {data.referredBusinesses.length === 0 ? (
          <p className="text-sm text-ink-muted">Nobody has signed up through your link yet.</p>
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border">
            {data.referredBusinesses.map((r) => (
              <div key={r.organizationId} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-ink">{r.displayName}</div>
                  <div className="text-xs text-ink-muted">Signed up {formatRelativeDay(r.referredAt)}</div>
                </div>
                <span className="text-xs font-medium text-ink-muted">{STATUS_LABEL[r.subscriptionStatus] ?? r.subscriptionStatus}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold text-ink">Recent earnings</h2>
        {data.earnings.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Nothing yet — commission is earned when a referred business&apos;s subscription payment goes through.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border">
            {data.earnings.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-ink">{e.isBonus ? "Signup bonus" : e.businessName}</div>
                  <div className="text-xs text-ink-muted">
                    {e.isBonus ? `Unlocked via ${e.businessName} · ` : ""}
                    {formatRelativeDay(e.createdAt)}
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums text-ink">{formatKobo(e.commissionKobo)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold text-ink">Payout history</h2>
        {data.payouts.length === 0 ? (
          <p className="text-sm text-ink-muted">No payouts recorded yet.</p>
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border">
            {data.payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-ink">{p.note || "Payout"}</div>
                  <div className="text-xs text-ink-muted">{formatRelativeDay(p.createdAt)}</div>
                </div>
                <span className="text-sm font-semibold tabular-nums text-ink">{formatKobo(p.amountKobo)}</span>
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
