"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BusinessError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="size-6" />
      </div>
      <div>
        <h1 className="font-display text-lg font-semibold text-ink">This page hit a snag</h1>
        <p className="mt-1.5 max-w-xs text-sm text-ink-muted">
          Something went wrong loading this section. Your data is safe — try again, or head back to the dashboard.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => router.push("/business")}>
          Go to dashboard
        </Button>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
