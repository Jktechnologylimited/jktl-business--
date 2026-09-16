"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import type { NewSaleInput, NewSaleLineInput } from "@/lib/store";
import { formatKobo, nairaToKobo } from "@/lib/format";
import type { Customer, LineKind, PaymentMethod, PaymentStatus, Product, Service } from "@/lib/types";

interface DraftLine {
  key: string;
  kind: LineKind;
  refId: string;
  quantity: number;
}

let draftKeySeq = 0;
function nextKey() {
  draftKeySeq += 1;
  return `line-${draftKeySeq}`;
}

export function SaleForm({
  customers,
  services,
  products,
  onSubmit,
  onCancel,
}: {
  customers: Customer[];
  services: Service[];
  products: Product[];
  onSubmit: (input: NewSaleInput) => void;
  onCancel: () => void;
}) {
  const [customerId, setCustomerId] = useState<string>(customers[0]?.id ?? "");
  const [lines, setLines] = useState<DraftLine[]>(
    services[0] ? [{ key: nextKey(), kind: "service", refId: services[0].id, quantity: 1 }] : [],
  );
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("paid");
  const [notes, setNotes] = useState("");

  function catalogFor(kind: LineKind) {
    return kind === "service" ? services : products;
  }
  function itemDetails(kind: LineKind, refId: string) {
    const item = catalogFor(kind).find((i) => i.id === refId);
    return { name: item?.name ?? "Unknown", priceKobo: item?.priceKobo ?? 0 };
  }

  function addLine() {
    const firstService = services[0];
    setLines((prev) => [
      ...prev,
      { key: nextKey(), kind: "service", refId: firstService?.id ?? products[0]?.id ?? "", quantity: 1 },
    ]);
  }
  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }
  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        if (patch.kind && patch.kind !== l.kind) {
          next.refId = catalogFor(patch.kind)[0]?.id ?? "";
        }
        return next;
      }),
    );
  }

  const resolvedLines: (NewSaleLineInput & { key: string })[] = lines.map((l) => {
    const { name, priceKobo } = itemDetails(l.kind, l.refId);
    return { key: l.key, kind: l.kind, refId: l.refId, name, quantity: l.quantity, unitPriceKobo: priceKobo };
  });
  const subtotalKobo = resolvedLines.reduce((sum, l) => sum + l.quantity * l.unitPriceKobo, 0);
  const discountKobo = nairaToKobo(Number(discount) || 0);
  const totalKobo = Math.max(0, subtotalKobo - discountKobo);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (resolvedLines.length === 0) return;
    onSubmit({
      customerId: customerId || null,
      items: resolvedLines.map((line) => ({
        kind: line.kind,
        refId: line.refId,
        name: line.name,
        quantity: line.quantity,
        unitPriceKobo: line.unitPriceKobo,
      })),
      discountKobo,
      paymentMethod,
      paymentStatus,
      notes,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Customer" htmlFor="sl-customer">
        <Select id="sl-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Walk-in (no account)</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="flex flex-col gap-3">
        <div className="text-sm font-medium text-ink">Items</div>
        {resolvedLines.map((line, idx) => (
          <div key={line.key} className="rounded-xl border border-border-strong p-3">
            <div className="flex gap-2">
              <Select
                value={lines[idx].kind}
                onChange={(e) => updateLine(line.key, { kind: e.target.value as LineKind })}
                className="w-28 shrink-0"
              >
                <option value="service">Service</option>
                <option value="product">Product</option>
              </Select>
              <Select value={line.refId} onChange={(e) => updateLine(line.key, { refId: e.target.value })} className="flex-1">
                {catalogFor(lines[idx].kind).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
              <button
                type="button"
                onClick={() => removeLine(line.key)}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl text-danger hover:bg-danger-soft"
                aria-label="Remove item"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-muted">Qty</span>
                <Input
                  type="number"
                  min="1"
                  value={line.quantity}
                  onChange={(e) => updateLine(line.key, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                  className="h-9 w-16 px-2 text-center"
                />
              </div>
              <span className="text-sm font-semibold text-ink">{formatKobo(line.quantity * line.unitPriceKobo)}</span>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addLine} className="self-start">
          <Plus className="size-4" /> Add item
        </Button>
      </div>

      <Field label="Discount (₦, optional)" htmlFor="sl-discount">
        <Input id="sl-discount" type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Payment method" htmlFor="sl-method">
          <Select id="sl-method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
            <option value="cash">Cash</option>
            <option value="transfer">Transfer</option>
            <option value="pos">POS</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Payment status" htmlFor="sl-status">
          <Select id="sl-status" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
          </Select>
        </Field>
      </div>

      <Field label="Notes (optional)" htmlFor="sl-notes">
        <Input id="sl-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <div className="flex items-center justify-between rounded-xl bg-surface px-4 py-3">
        <span className="text-sm font-medium text-ink-muted">Total</span>
        <span className="font-display text-lg font-bold text-ink">{formatKobo(totalKobo)}</span>
      </div>

      <div className="mt-1 flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={resolvedLines.length === 0}>
          Record sale
        </Button>
      </div>
    </form>
  );
}
