import Image from "next/image";
import { cn } from "@/lib/utils";

export function JktlMark({ className }: { className?: string }) {
  return (
    <div
      className={cn("relative flex items-center justify-center overflow-hidden rounded-[28%] bg-primary", className)}
      aria-hidden
    >
      <Image src="/jktl-logo.png" alt="" fill className="object-contain p-[16%]" sizes="48px" />
    </div>
  );
}

export function JktlWordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <JktlMark className="size-9 text-lg" />
      <div className="leading-tight">
        <div className="font-display text-base font-bold tracking-tight text-ink">JKTL Business</div>
        <div className="text-[11px] font-medium text-ink-muted">SalonDesk</div>
      </div>
    </div>
  );
}
