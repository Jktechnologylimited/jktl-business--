import Link from "next/link";
import { JktlMark } from "@/components/app/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <JktlMark className="size-12" />
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight text-ink">Page not found</h1>
        <p className="mt-1.5 max-w-xs text-sm text-ink-muted">
          That page doesn&apos;t exist, or the link may be out of date.
        </p>
      </div>
      <Link href="/business">
        <Button>Go to dashboard</Button>
      </Link>
    </div>
  );
}
