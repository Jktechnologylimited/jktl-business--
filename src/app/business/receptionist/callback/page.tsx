"use client";
import { T } from "@/components/i18n/LanguageProvider";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reconcilePaymentAction } from "@/lib/actions/receptionist-actions";

/**
 * Where Paystack returns the buyer after a wallet top-up or the setup fee.
 *
 * The webhook is the authoritative fulfilment path — it fires even if this
 * page is never reached — so this exists purely to give the person immediate,
 * honest feedback. Both paths call the same idempotent functions, keyed on the
 * Paystack reference, so arriving here after the webhook already applied is
 * expected and does not double-credit.
 *
 * The reference is read from `window.location` in a lazy initializer rather
 * than with `useSearchParams`, which keeps this page free of a Suspense
 * boundary it has no other need for.
 */
export default function ReceptionistCallbackPage() {
  const router = useRouter();
  const [reference] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("reference"),
  );
  const [state, setState] = useState<"working" | "done" | "failed">("working");
  const [message, setMessage] = useState(
    "Confirming your payment with Paystack…",
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // Yield once before touching state so the effect body itself never
      // triggers a synchronous re-render.
      await Promise.resolve();
      if (cancelled) return;

      if (!reference) {
        setState("failed");
        setMessage(
          "No payment reference was returned. If you were debited, send us the reference and we'll credit it manually.",
        );
        return;
      }

      const result = await reconcilePaymentAction(reference);
      if (cancelled) return;
      if (result.ok) {
        setState("done");
        setMessage(result.data.detail);
      } else {
        setState("failed");
        setMessage(result.error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reference]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-paper p-6 text-center">
      {state === "working" ? (
        <Loader2 className="size-8 animate-spin text-primary" />
      ) : null}
      {state === "done" ? (
        <CheckCircle2 className="size-8 text-primary" />
      ) : null}
      {state === "failed" ? <XCircle className="size-8 text-danger" /> : null}

      <div>
        <h1 className="font-display text-lg font-semibold text-ink">
          {state === "working"
            ? "Confirming payment"
            : state === "done"
              ? "Payment confirmed"
              : "We couldn't confirm that yet"}
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">{message}</p>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => router.push("/business/receptionist")}
      >
        <T>Back to the receptionist</T>
      </Button>
      <Link
        href="/business/receptionist"
        className="text-xs text-ink-faint hover:text-ink"
      >
        <T>Or tap here</T>
      </Link>
    </div>
  );
}
