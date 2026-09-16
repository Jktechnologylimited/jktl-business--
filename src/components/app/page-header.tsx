import type { ReactNode } from "react";

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{title}</h1>
      {action}
    </div>
  );
}
