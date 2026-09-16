import { cn } from "@/lib/utils";

const ruleClasses = {
  primary: "border-primary",
  accent: "border-accent",
  info: "border-info",
  danger: "border-danger",
} as const;

export function StatTile({
  label,
  value,
  sub,
  rule = "primary",
}: {
  label: string;
  value: string;
  sub?: string;
  rule?: keyof typeof ruleClasses;
}) {
  return (
    <div className={cn("rounded-2xl border-l-4 bg-surface p-4", ruleClasses[rule])}>
      <div className="text-[13px] font-medium text-ink-muted">{label}</div>
      <div className="mt-1.5 font-display text-2xl font-bold tracking-tight text-ink">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-ink-muted">{sub}</div> : null}
    </div>
  );
}
