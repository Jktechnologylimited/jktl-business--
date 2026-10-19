import type { ReactNode } from "react";

/**
 * The one card shell every analytics block sits in.
 *
 * Extracted for the same reason `StatTile` and `EmptyState` are shared
 * components: the Analytics page is a stack of twelve sections, and twelve
 * hand-rolled `rounded-2xl border p-4` wrappers drift apart the moment one of
 * them is tweaked. The heading lives inside the card so an empty state and a
 * chart occupy identical frames — a section never collapses to a bare
 * sentence surrounded by whitespace.
 */
export function Card({
  title,
  hint,
  action,
  children,
  className,
}: {
  title: string;
  /** A short line under the title explaining what the block is showing. */
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-border bg-paper p-4 ${className ?? ""}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
          {hint ? <p className="mt-0.5 text-xs text-ink-muted">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * A labelled horizontal bar with a value on the right.
 *
 * Used for every ranked/percentage list on the page (payment mix, booking
 * status, expense categories, peak hours). Bars are divs rather than a chart
 * library because these lists are short, must read on a phone, and the point
 * is the number and its label — not the shape.
 */
export function RankedBar({
  label,
  value,
  valueLabel,
  sharePct,
  tone = "primary",
  badge,
}: {
  label: string;
  /** The magnitude the bar length is scaled to, as a share of the list max. */
  value: number;
  valueLabel: string;
  /** Optional percentage caption next to the amount. */
  sharePct?: number;
  tone?: "primary" | "accent" | "info" | "danger";
  badge?: ReactNode;
}) {
  const toneClass = {
    primary: "bg-primary",
    accent: "bg-accent",
    info: "bg-info",
    danger: "bg-danger",
  }[tone];

  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
          <span className="truncate">{label}</span>
          {badge}
        </span>
        <span className="shrink-0 text-sm font-semibold text-ink">
          {valueLabel}
          {sharePct !== undefined ? <span className="ml-1.5 text-xs font-normal text-ink-muted">{sharePct}%</span> : null}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-strong">
        {/* Width is a 0–100% share of the list's largest value, clamped so a
            single-item list still reads as "all of it" rather than 100×. */}
        <div className={`h-full rounded-full ${toneClass}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}
