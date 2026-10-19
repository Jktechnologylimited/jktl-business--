import Link from "next/link";
import { ArrowRight, BadgeCheck, Handshake, MousePointerClick, Users, Wallet } from "lucide-react";
import { JktlMark } from "@/components/app/logo";
import { buttonVariants } from "@/components/ui/button";
import { formatKobo } from "@/lib/format";
import {
  RECURRING_MONTHLY_KOBO,
  SIGNUP_BONUS_KOBO,
  SUBSCRIPTION_BONUS_KOBO,
  firstYearValueKobo,
} from "@/lib/affiliate-commission";

/**
 * The partner programme's public front door.
 *
 * This is what `jktl.com.ng/affiliate` and `business.jktl.com.ng/affiliates` show
 * to somebody who is not signed in. Before this existed, the top-level affiliate
 * URL redirected straight to a login form — so a partner arriving from the
 * marketing site, or from a link a friend sent, hit a password prompt for an
 * account they had no way to create. The signup page existed at
 * `/affiliates/apply`; nothing pointed at it.
 *
 * The figures come from `src/lib/affiliate-commission.ts`, the same constants the
 * ledger pays from. A landing page that promises a rate the ledger does not
 * honour is the most expensive kind of bug in an affiliate programme, so there is
 * exactly one source for the numbers and a test asserting the two agree.
 */
export function AffiliateLanding() {
  const firstYear = firstYearValueKobo();

  const tiers = [
    { amount: formatKobo(SIGNUP_BONUS_KOBO), when: "when they create an account", note: "held until they subscribe" },
    { amount: formatKobo(SUBSCRIPTION_BONUS_KOBO), when: "when they subscribe", note: "releases the signup bonus too" },
    { amount: formatKobo(RECURRING_MONTHLY_KOBO), when: "every month they stay subscribed", note: "for as long as they stay" },
  ];

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-5">
          <div className="flex items-center gap-2.5">
            <JktlMark className="size-7" />
            <Link href="/" className="font-display text-sm font-semibold text-ink">
              JKTL Business
            </Link>
          </div>
          <Link href="/affiliates/login" className="text-sm font-medium text-primary">
            Partner sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="flex items-center gap-2 text-primary">
          <Handshake className="size-5" />
          <span className="text-sm font-semibold uppercase tracking-wide">Partner programme</span>
        </div>

        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Earn {formatKobo(firstYear)} from one referral in the first year.
        </h1>
        <p className="mt-3 max-w-2xl text-ink-muted">
          Introduce a Nigerian business to JKTL Business. When they join and start using it, you get paid — and paid again every
          month for as long as they stay. No cap on how many businesses you refer.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href="/affiliates/apply" className={buttonVariants({ size: "lg" })}>
            Apply to join <ArrowRight className="size-4" />
          </Link>
          <Link href="/affiliates/login" className="text-sm font-medium text-primary">
            Already a partner? Sign in
          </Link>
        </div>

        {/* The offer, in the order it happens. */}
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold text-ink">How you get paid</h2>
          <ol className="mt-4 flex flex-col gap-3">
            {tiers.map((tier, index) => (
              <li key={tier.when} className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-paper text-xs font-semibold text-ink-muted">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm">
                    <strong className="font-display text-base font-semibold text-ink">{tier.amount}</strong>{" "}
                    <span className="text-ink-muted">{tier.when}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint">{tier.note}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-3 rounded-xl bg-paper px-3 py-2 text-xs text-ink-muted">
            <strong className="font-semibold text-ink">Why the first one is held.</strong> {" "}
            {formatKobo(SIGNUP_BONUS_KOBO)} is credited the moment your referral creates an account — you can see it in your dashboard
            straight away — but it becomes withdrawable when they subscribe. That is what stops the bonus being earned by free accounts,
            and it costs an honest partner nothing: your {formatKobo(SIGNUP_BONUS_KOBO + SUBSCRIPTION_BONUS_KOBO)} lands in one go as soon
            as they pay.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold text-ink">What you actually do</h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm text-ink-muted">
            <li className="flex items-start gap-3">
              <MousePointerClick className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <strong className="font-semibold text-ink">Get your link.</strong> Approved partners get a personal referral link and
                a code. Anything that comes through it is yours, for 30 days and for as long as the business stays.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Users className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <strong className="font-semibold text-ink">Introduce businesses.</strong> Salons, clinics, gyms, shops, restaurants,
                pharmacies, home-care services — any business that takes bookings or payments. WhatsApp is where this works best;
                there are ready-made materials in your dashboard.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Wallet className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <strong className="font-semibold text-ink">Get paid.</strong> Payouts open from the 21st of each month to a Nigerian
                bank account in your name. You can watch earnings accrue in real time — every signup, every subscription, every month.
              </span>
            </li>
          </ul>
        </section>

        <section className="mt-10 rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2">
            <BadgeCheck className="size-4 text-primary" />
            <h2 className="font-display text-base font-semibold text-ink">How to join</h2>
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            Apply in about a minute — your name, email, a password, and a line on how you plan to promote JKTL. Applications are
            reviewed by hand and usually approved within 24–48 hours. Once you are approved you can sign in immediately; there is
            nothing else to set up.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/affiliates/apply" className={buttonVariants()}>
              Apply to join
            </Link>
            <Link href="/affiliates/login" className={buttonVariants({ variant: "outline" })}>
              Partner sign in
            </Link>
          </div>
        </section>

        <p className="mt-8 text-xs text-ink-faint">
          JKTL Business is the product your referrals will be using: bookings, invoicing, inventory, expenses and a free business
          website, with an AI receptionist that answers calls nobody could pick up.
        </p>
      </main>
    </div>
  );
}
