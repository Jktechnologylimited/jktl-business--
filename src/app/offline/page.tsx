export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-2xl">
        📶
      </div>
      <h1 className="mt-6 font-display text-xl font-semibold tracking-tight text-ink">
        You&apos;re offline
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        This page hasn&apos;t been opened yet while offline, so there&apos;s nothing saved to show.
        Reconnect and try again — pages you&apos;ve already visited will keep working without a
        connection.
      </p>
    </div>
  );
}
