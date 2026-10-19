import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The mark.
 *
 * `priority` because this is almost always the largest thing above the fold —
 * the login page, the marketing shell, the affiliate portal all lead with it —
 * so lazy-loading it defers the Largest Contentful Paint for no benefit. Next
 * warns about exactly this when it detects the pattern.
 */
export function JktlMark({ className, priority = true }: { className?: string; priority?: boolean }) {
  return (
    <div className={cn("relative", className)} aria-hidden>
      <Image src="/jktl-logo.png" alt="" fill priority={priority} className="object-contain" sizes="48px" />
    </div>
  );
}

export function JktlWordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <JktlMark className="size-9" />
      <div className="font-display text-base font-bold tracking-tight text-ink">JKTL Business</div>
    </div>
  );
}
