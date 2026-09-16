import Image from "next/image";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

export function Avatar({
  name,
  src,
  className,
  textClassName,
}: {
  name: string;
  src: string | null | undefined;
  className?: string;
  textClassName?: string;
}) {
  if (src) {
    return (
      <div className={cn("relative shrink-0 overflow-hidden rounded-full bg-surface-strong", className)}>
        <Image src={src} alt={name} fill unoptimized className="object-cover" sizes="64px" />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-strong",
        className,
        textClassName,
      )}
    >
      {initials(name)}
    </div>
  );
}
