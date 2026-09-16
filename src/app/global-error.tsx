"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger">
            <AlertTriangle className="size-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-ink">Something went wrong</h1>
            <p className="mt-1.5 max-w-xs text-sm text-ink-muted">
              An unexpected error stopped the page from loading. Your data is safe — this is just a display issue.
            </p>
          </div>
          <Button onClick={reset}>Try again</Button>
        </div>
      </body>
    </html>
  );
}
