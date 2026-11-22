"use client";
import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, RefreshCw, BookOpen } from "lucide-react";

export function WorkspaceUnavailable({ title, detail, retry }: {
  title: string; detail: string; retry?: () => void;
}) {
  const router = useRouter(), [pending, startTransition] = useTransition();
  return <section className="rounded-xl border border-border bg-paper p-5" aria-labelledby="workspace-error-title">
    <CircleAlert className="mb-3 size-6 text-warning" aria-hidden="true" />
    <h1 id="workspace-error-title" className="text-xl font-semibold">{title}</h1>
    <p className="mt-2 max-w-2xl text-sm text-ink-muted">{detail}</p>
    <div className="mt-4 flex flex-wrap gap-2">
      <button disabled={pending} onClick={() => startTransition(() => retry ? retry() : router.refresh())}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">
        <RefreshCw size={15} aria-hidden="true" />{pending ? "Reloading…" : "Try again"}
      </button>
      <Link href="/admin/knowledge" prefetch={false} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold"><BookOpen size={15} aria-hidden="true" />Open knowledge base</Link>
    </div>
  </section>;
}
