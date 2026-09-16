import { cn } from "@/lib/utils";

export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
            value === opt.value ? "bg-primary text-white" : "bg-surface text-ink-muted hover:bg-surface-strong",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
