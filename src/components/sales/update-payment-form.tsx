"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { ReceiptPhotoField } from "@/components/sales/receipt-photo-field";
import type { SalePaymentInput } from "@/lib/store";
import { formatKobo, nairaToKobo, koboToNaira } from "@/lib/format";
import type { Sale } from "@/lib/types";

export function UpdatePaymentForm({
  sale,
  onSubmit,
  onCancel,
}: {
  sale: Sale;
  onSubmit: (patch: SalePaymentInput) => void;
  onCancel: () => void;
}) {
  const [amountPaid, setAmountPaid] = useState(String(koboToNaira(sale.amountPaidKobo)));
  const [receiptPhotoUrl, setReceiptPhotoUrl] = useState<string | null>(sale.receiptPhotoUrl);

  const amountPaidKobo = Math.min(sale.totalKobo, Math.max(0, nairaToKobo(Number(amountPaid) || 0)));
  const balanceKobo = Math.max(0, sale.totalKobo - amountPaidKobo);
  const paymentStatus = amountPaidKobo <= 0 ? "pending" : amountPaidKobo >= sale.totalKobo ? "paid" : "partial";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ paymentStatus, amountPaidKobo, receiptPhotoUrl });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="rounded-xl bg-surface px-4 py-3 text-sm">
        <div className="flex justify-between text-ink-muted">
          <span>Sale total</span>
          <span className="font-medium text-ink">{formatKobo(sale.totalKobo)}</span>
        </div>
      </div>

      <Field label="Amount paid (₦)" htmlFor="pay-amount">
        <Input
          id="pay-amount"
          type="number"
          min="0"
          max={sale.totalKobo / 100}
          value={amountPaid}
          onChange={(e) => setAmountPaid(e.target.value)}
          autoFocus
        />
      </Field>

      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-muted">Balance remaining</span>
        <span className={balanceKobo > 0 ? "font-semibold text-danger" : "font-semibold text-primary-strong"}>
          {formatKobo(balanceKobo)}
        </span>
      </div>

      <ReceiptPhotoField value={receiptPhotoUrl} onChange={setReceiptPhotoUrl} />

      <div className="mt-1 flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1">
          Save payment
        </Button>
      </div>
    </form>
  );
}
