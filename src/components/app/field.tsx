import { T } from "@/components/i18n/LanguageProvider";
import type { ReactNode } from "react";

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        <T>{label}</T>
      </label>
      {children}
      {hint ? (
        <p className="text-xs text-ink-muted">
          <T>{hint}</T>
        </p>
      ) : null}
    </div>
  );
}
