import Image from "next/image";
import { cn } from "@/lib/utils";

export function JktlMark({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)} aria-hidden>
      <Image src="/jktl-logo.png" alt="" fill className="object-contain" sizes="48px" />
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
