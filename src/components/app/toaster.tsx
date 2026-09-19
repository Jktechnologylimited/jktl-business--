"use client";

import { useToastStore } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto rounded-full px-4 py-2.5 text-sm font-medium text-white shadow-lg",
            t.tone === "danger" ? "bg-toast-danger" : "bg-toast",
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
