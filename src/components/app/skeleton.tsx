import { cn } from "@/lib/utils";

export function SkeletonBar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-strong", className)} />;
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <SkeletonBar className="h-7 w-48" />
        <SkeletonBar className="mt-2 h-4 w-32" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border-l-4 border-border-strong bg-surface p-4">
            <SkeletonBar className="h-3.5 w-20" />
            <SkeletonBar className="mt-2.5 h-6 w-24" />
          </div>
        ))}
      </div>
      <div>
        <SkeletonBar className="mb-3 h-5 w-32" />
        <div className="divide-y divide-border rounded-2xl border border-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <SkeletonBar className="h-4 w-10" />
              <SkeletonBar className="h-4 flex-1" />
              <SkeletonBar className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border rounded-2xl border border-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <SkeletonBar className="size-10 shrink-0 rounded-full" />
          <div className="flex-1">
            <SkeletonBar className="h-4 w-1/3" />
            <SkeletonBar className="mt-2 h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
