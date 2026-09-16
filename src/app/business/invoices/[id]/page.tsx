"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusPill, invoiceStatusMeta } from "@/components/app/status-pill";
import { useBusinessStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { customerName } from "@/lib/selectors";
import { formatKobo, formatShortDate } from "@/lib/format";

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const data = useBusinessStore((s) => s.data);
  const updateInvoiceStatus = useBusinessStore((s) => s.updateInvoiceStatus);
  const deleteInvoice = useBusinessStore((s) => s.deleteInvoice);
  const showToast = useToastStore((s) => s.show);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const invoice = data.invoices.find((i) => i.id === params.id);
  const items = data.invoiceItems.filter((i) => i.invoiceId === params.id);

  if (!invoice) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-ink-muted">This invoice no longer exists.</p>
        <Link href="/business/invoices" className="text-sm font-medium text-primary">
          Back to invoices
        </Link>
      </div>
    );
  }

  const meta = invoiceStatusMeta(invoice.status);
  const customer = data.customers.find((c) => c.id === invoice.customerId);
  const inv = invoice; // narrowed, non-undefined — safe to close over below

  async function copySummary() {
    const lines = [
      `${data.profile.displayName}`,
      `Invoice ${inv.number}`,
      `To: ${customerName(data.customers, inv.customerId)}`,
      `Due: ${formatShortDate(inv.dueDate)}`,
      ...items.map((i) => `${i.description} x${i.quantity} — ${formatKobo(i.totalKobo)}`),
      `Total: ${formatKobo(inv.totalKobo)}`,
      `Status: ${meta.label}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      showToast("Invoice summary copied");
    } catch {
      showToast("Couldn't copy — try printing instead", "danger");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/business/invoices" className="flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Invoices
        </Link>
        <button onClick={() => setConfirmingDelete(true)} className="flex size-8 items-center justify-center rounded-lg text-danger hover:bg-danger-soft" aria-label="Delete">
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="rounded-2xl border border-border p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-display text-lg font-bold text-ink">{data.profile.displayName}</div>
            <div className="text-xs text-ink-muted">{data.profile.address}, {data.profile.city}</div>
            <div className="text-xs text-ink-muted">{data.profile.phone}</div>
          </div>
          <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm">
          <div>
            <div className="text-xs text-ink-faint">Invoice</div>
            <div className="font-medium text-ink">{invoice.number}</div>
          </div>
          <div>
            <div className="text-xs text-ink-faint">Bill to</div>
            <div className="font-medium text-ink">{customer?.name ?? "Unknown"}</div>
          </div>
          <div>
            <div className="text-xs text-ink-faint">Issued</div>
            <div className="font-medium text-ink">{formatShortDate(invoice.issueDate)}</div>
          </div>
          <div>
            <div className="text-xs text-ink-faint">Due</div>
            <div className="font-medium text-ink">{formatShortDate(invoice.dueDate)}</div>
          </div>
        </div>

        <div className="mt-5 divide-y divide-border border-y border-border">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <div className="text-ink">{item.description}</div>
                <div className="text-xs text-ink-muted">
                  {item.quantity} × {formatKobo(item.unitPriceKobo)}
                </div>
              </div>
              <div className="font-medium text-ink">{formatKobo(item.totalKobo)}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col items-end gap-1 text-sm">
          <div className="flex w-40 justify-between text-ink-muted">
            <span>Subtotal</span>
            <span>{formatKobo(invoice.subtotalKobo)}</span>
          </div>
          {invoice.discountKobo > 0 ? (
            <div className="flex w-40 justify-between text-ink-muted">
              <span>Discount</span>
              <span>-{formatKobo(invoice.discountKobo)}</span>
            </div>
          ) : null}
          <div className="flex w-40 justify-between border-t border-border pt-1 font-display text-base font-bold text-ink">
            <span>Total</span>
            <span>{formatKobo(invoice.totalKobo)}</span>
          </div>
        </div>

        {invoice.notes ? <p className="mt-4 text-sm text-ink-muted">{invoice.notes}</p> : null}
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        {invoice.status !== "paid" ? (
          <Button size="sm" onClick={() => { updateInvoiceStatus(invoice.id, "paid"); showToast("Marked as paid"); }}>
            Mark as paid
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => { updateInvoiceStatus(invoice.id, "pending"); showToast("Marked as pending"); }}>
            Mark as pending
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" /> Print / Download
        </Button>
        <Button size="sm" variant="outline" onClick={copySummary}>
          <Share2 className="size-4" /> Copy summary
        </Button>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete invoice ${invoice.number}?`}
        description="This can't be undone."
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          deleteInvoice(invoice.id);
          showToast("Invoice deleted");
          router.push("/business/invoices");
        }}
      />
    </div>
  );
}
