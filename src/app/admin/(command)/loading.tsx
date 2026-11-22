export default function Loading() {
  return <div role="status" aria-live="polite" className="space-y-4">
    <p className="text-sm text-ink-muted">Loading workspace…</p>
    <div aria-hidden="true" className="h-10 max-w-sm rounded-lg bg-surface-strong" />
    <div aria-hidden="true" className="h-40 rounded-xl border border-border bg-paper" />
  </div>;
}
