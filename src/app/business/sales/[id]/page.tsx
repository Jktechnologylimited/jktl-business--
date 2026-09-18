"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Receipt, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { StatusPill, paymentStatusMeta } from "@/components/app/status-pill";
import { UpdatePaymentForm } from "@/components/sales/update-payment-form";
import { useBusinessStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { customerName } from "@/lib/selectors";
import { formatKobo, formatShortDate, formatTime } from "@/lib/format";

export default function SaleDetailPage() {
  const params = useParams<{ id: string }>();
  const data = useBusinessStore((s) => s.data);
  const updateSalePayment = useBusinessStore((s) => s.updateSalePayment);
  const showToast = useToastStore((s) => s.show);
  const [updatingPayment, setUpdatingPayment] = useState(false);

  const sale = data.sales.find((s) => s.id === params.id);
  const items = data.saleItems.filter((i) => i.saleId === params.id);

  if (!sale) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-ink-muted">This sale no longer exists.</p>
        <Link href="/business/sales" className="text-sm font-medium text-primary">
          Back to sales
        </Link>
      </div>
    );
  }

  const meta = paymentStatusMeta(sale.paymentStatus);
  const balanceKobo = Math.max(0, sale.totalKobo - sale.amountPaidKobo);
  const s = sale; // narrowed, non-undefined — safe to close over below

  async function copySummary() {
    const lines = [
      `${data.profile.displayName}`,
      `Sale — ${formatShortDate(s.createdAt)}, ${formatTime(s.createdAt)}`,
      `Customer: ${customerName(data.customers, s.customerId)}`,
      ...items.map((i) => `${i.name} x${i.quantity} — ${formatKobo(i.totalKobo)}`),
      `Total: ${formatKobo(s.totalKobo)}`,
      `Paid: ${formatKobo(s.amountPaidKobo)}${balanceKobo > 0 ? ` (balance ${formatKobo(balanceKobo)})` : ""}`,
      `Status: ${meta.label}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      showToast("Sale summary copied");
    } catch {
      showToast("Couldn't copy summary", "danger");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link href="/business/sales" className="flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Sales
        </Link>
      </div>

      <div className="rounded-2xl border border-border p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-display text-lg font-bold text-ink">{customerName(data.customers, sale.customerId)}</div>
            <div className="text-xs text-ink-muted">
              {formatShortDate(sale.createdAt)}, {formatTime(sale.createdAt)} · {sale.paymentMethod.toUpperCase()}
            </div>
          </div>
          <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
        </div>

        <div className="mt-5 divide-y divide-border border-y border-border">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <div className="text-ink">{item.name}</div>
                <div className="text-xs text-ink-muted">
                  {item.quantity} × {formatKobo(item.unitPriceKobo)}
                </div>
              </div>
              <div className="font-medium text-ink">{formatKobo(item.totalKobo)}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col items-end gap-1 text-sm">
          <div className="flex w-48 justify-between text-ink-muted">
            <span>Subtotal</span>
            <span>{formatKobo(sale.subtotalKobo)}</span>
          </div>
          {sale.discountKobo > 0 ? (
            <div className="flex w-48 justify-between text-ink-muted">
              <span>Discount</span>
              <span>-{formatKobo(sale.discountKobo)}</span>
            </div>
          ) : null}
          <div className="flex w-48 justify-between border-t border-border pt-1 font-display text-base font-bold text-ink">
            <span>Total</span>
            <span>{formatKobo(sale.totalKobo)}</span>
          </div>
          <div className="flex w-48 justify-between text-ink-muted">
            <span>Paid</span>
            <span>{formatKobo(sale.amountPaidKobo)}</span>
          </div>
          {balanceKobo > 0 ? (
            <div className="flex w-48 justify-between font-medium text-danger">
              <span>Balance</span>
              <span>{formatKobo(balanceKobo)}</span>
            </div>
          ) : null}
        </div>

        {sale.notes ? <p className="mt-4 text-sm text-ink-muted">{sale.notes}</p> : null}

        {sale.receiptPhotoUrl ? (
          <div className="mt-4">
            <div className="mb-1.5 text-xs font-medium text-ink-muted">Receipt photo</div>
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL, not a static asset */}
            <img src={sale.receiptPhotoUrl} alt="Receipt" className="max-h-72 w-full rounded-xl border border-border object-contain bg-surface" />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {sale.paymentStatus !== "paid" ? (
          <Button size="sm" onClick={() => setUpdatingPayment(true)}>
            <Receipt className="size-4" /> Update payment
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setUpdatingPayment(true)}>
            <Receipt className="size-4" /> {sale.receiptPhotoUrl ? "Replace receipt photo" : "Add receipt photo"}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={copySummary}>
          <Share2 className="size-4" /> Copy summary
        </Button>
      </div>

      <Sheet open={updatingPayment} onClose={() => setUpdatingPayment(false)} title="Update payment">
        <UpdatePaymentForm
          sale={sale}
          onCancel={() => setUpdatingPayment(false)}
          onSubmit={(patch) => {
            updateSalePayment(sale.id, patch);
            setUpdatingPayment(false);
            showToast(patch.paymentStatus === "paid" ? "Marked as fully paid" : "Payment updated");
          }}
        />
      </Sheet>
    </div>
  );
}
