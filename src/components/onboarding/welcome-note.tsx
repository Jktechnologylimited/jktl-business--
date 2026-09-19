import { JktlMark } from "@/components/app/logo";

/** A personal note shown once, on the onboarding "you're all set" screen —
 * every new business account gets this, signed by JKTL's own founder
 * rather than reading like an automated system message. */
export function WelcomeNote({ businessName }: { businessName: string }) {
  return (
    <div className="mt-6 w-full rounded-2xl border border-border bg-surface p-5 text-left">
      <div className="flex items-center gap-2.5">
        <JktlMark className="size-8 shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink">A note from JKTL</div>
          <div className="text-xs text-ink-muted">John · Founder &amp; CEO, JKTL</div>
        </div>
      </div>
      <p className="mt-3.5 text-sm leading-relaxed text-ink-muted">
        Welcome to JKTL Business{businessName ? `, ${businessName}` : ""} — I&apos;m genuinely glad you&apos;re here. We
        built this so you could spend less time on paperwork and more time with your customers. Your dashboard,
        bookings and public website are ready to go, and sample data is already in place so you can see how
        everything works before you add your own.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">
        If anything is confusing or breaks, don&apos;t hesitate to reach out from the Help page — a real person reads
        every message. Here&apos;s to growing your business.
      </p>
      <p className="mt-4 font-display text-sm font-semibold text-ink">— John</p>
    </div>
  );
}
