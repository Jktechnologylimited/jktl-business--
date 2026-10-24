import { T } from "@/components/i18n/LanguageProvider";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
        <T>{title}</T>
      </h1>
      {action}
    </div>
  );
}
