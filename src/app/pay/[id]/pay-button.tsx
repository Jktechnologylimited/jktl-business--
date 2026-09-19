"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initiateInvoicePaymentAction } from "@/lib/actions/invoice-payment-actions";

export function PayButton({ invoiceId }: { invoiceId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    setPending(true);
    setError("");
    const result = await initiateInvoicePaymentAction(invoiceId);
    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }
    window.location.href = result.data.authorizationUrl;
  }

  return (
    <div className="mt-4">
      <Button size="lg" className="w-full" onClick={pay} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {pending ? "Redirecting…" : "Pay now"}
      </Button>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
