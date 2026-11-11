"use client";
import { useEffect, useState } from "react";
import { checkWebsiteAddressAction } from "@/lib/actions/multiple-website-actions";
import { subdomainFormatError } from "@/lib/subdomain";
export function AddressPicker({
  value,
  onChange,
  exclude,
  onAvailable,
}: {
  value: string;
  onChange: (s: string) => void;
  exclude?: string;
  onAvailable?: (ok: boolean) => void;
}) {
  const [state, setState] = useState<{
    checked: boolean;
    checking: boolean;
    available: boolean;
    error: string;
    suggestions: string[];
  }>({
    checked: false,
    checking: false,
    available: false,
    error: "",
    suggestions: [],
  });
  useEffect(() => {
    let active = true;
    const error = subdomainFormatError(value);
    const timer = setTimeout(() => {
      if (error) {
        if (active) {
          setState({
            checked: false,
            checking: false,
            available: false,
            error,
            suggestions: [],
          });
          onAvailable?.(false);
        }
        return;
      }
      setState((s) => ({ ...s, checking: true }));
      onAvailable?.(false);
      void checkWebsiteAddressAction(value, exclude)
        .then((r) => {
          if (active) {
            setState({ ...r, checking: false, checked: true });
            onAvailable?.(r.available);
          }
        })
        .catch(() => {
          if (active) {
            setState({
              checked: false,
              checking: false,
              available: false,
              error: "Could not check availability. Please retry.",
              suggestions: [],
            });
            onAvailable?.(false);
          }
        });
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [value, exclude, onAvailable]);
  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold">
        Choose your JKTL subdomain
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={value}
            onChange={(e) => {
              onAvailable?.(false);
              onChange(e.target.value.toLowerCase().trim());
              setState((s) => ({ ...s, available: false, checked: false }));
            }}
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            maxLength={30}
            minLength={3}
            required
            className="min-w-0 flex-1 rounded-xl border border-border bg-paper p-3 text-ink"
            placeholder="your-business"
          />
          <span className="text-sm text-ink-muted">.jktl.com.ng</span>
        </div>
      </label>
      <p role="status" className="text-sm text-ink-muted">
        {state.checking
          ? "Checking availability…"
          : state.error ||
            (state.available
              ? "This address is available."
              : state.checked
                ? "That address is taken. Try another name or a suggestion."
                : "Enter a name to check availability.")}
      </p>
      {state.suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-muted">Available suggestions:</span>
          {state.suggestions.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => {
                onAvailable?.(false);
                onChange(s);
              }}
              className="rounded-full border border-border bg-paper px-3 py-2 text-xs font-medium"
            >
              {s}.jktl.com.ng
            </button>
          ))}
        </div>
      )}
      <p className="text-xs leading-6 text-ink-muted">
        Use 3–30 letters, numbers or hyphens. Availability is checked again when
        the address is saved.
      </p>
    </div>
  );
}
