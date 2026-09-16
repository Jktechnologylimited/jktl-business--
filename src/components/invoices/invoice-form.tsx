"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import type { NewInvoiceInput } from "@/lib/store";
import { formatKobo, nairaToKobo } from "@/lib/format";
import type { Customer, InvoiceStatus } from "@/lib/types";

interface DraftLine {
  key: string;
  description: string;
  quantity: number;
  unitPrice: string;
}

let seq = 0;
function nextKey() {
  seq += 1;
  return `inv-line-${seq}`;
}

export function InvoiceForm({
  customers,
  onSubmit,
  onCancel,
}: {
  customers: Customer[];
  onSubmit: (input: NewInvoiceInput) => void;
  onCancel: () => void;
}) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [lines, setLines] = useState<DraftLine[]>([{ key: nextKey(), description: "", quantity: 1, unitPrice: "" }]);
  const [discount, setDiscount] = useState("0");
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<InvoiceStatus>("pending");

  function addLine() {
    setLines((prev) => [...prev, { key: nextKey(), description: "", quantity: 1, unitPrice: "" }]);
  }
  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }
  function patchLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const subtotalKobo = lines.reduce((sum, l) => sum + l.quantity * nairaToKobo(Number(l.unitPrice) || 0), 0);
  const discountKobo = nairaToKobo(Number(discount) || 0);
  const totalKobo = Math.max(0, subtotalKobo - discountKobo);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const items = lines
      .filter((l) => l.description.trim())
      .map((l) => ({ description: l.description, quantity: l.quantity, unitPriceKobo: nairaToKobo(Number(l.unitPrice) || 0) }));
    if (items.length === 0 || !customerId) return;
    onSubmit({ customerId, items, discountKobo, dueDate: new Date(dueDate).toISOString().slice(0, 10), notes, status });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Customer" htmlFor="iv-customer">
        <Select id="iv-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="flex flex-col gap-3">
        <div className="text-sm font-medium text-ink">Items</div>
        {lines.map((line) => (
          <div key={line.key} className="rounded-xl border border-border-strong p-3">
            <Input
              value={line.description}
              onChange={(e) => patchLine(line.key, { description: e.target.value })}
              placeholder="e.g. Hair installation"
              className="mb-2"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-muted">Qty</span>
              <Input
                type="number"
                min="1"
                value={line.quantity}
                onChange={(e) => patchLine(line.key, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                className="h-9 w-16 px-2 text-center"
              />
              <span className="ml-2 text-xs text-ink-muted">Price (₦)</span>
              <Input
                type="number"
                min="0"
                value={line.unitPrice}
                onChange={(e) => patchLine(line.key, { unitPrice: e.target.value })}
                className="h-9 flex-1"
              />
              <button
                type="button"
                onClick={() => removeLine(line.key)}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-danger-soft"
                aria-label="Remove line"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addLine} className="self-start">
          <Plus className="size-4" /> Add line
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Discount (₦)" htmlFor="iv-discount">
          <Input id="iv-discount" type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </Field>
        <Field label="Due date" htmlFor="iv-due">
          <Input id="iv-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </Field>
      </div>

      <Field label="Status" htmlFor="iv-status">
        <Select id="iv-status" value={status} onChange={(e) => setStatus(e.target.value as InvoiceStatus)}>
          <option value="draft">Draft — not sent yet</option>
          <option value="pending">Pending — awaiting payment</option>
        </Select>
      </Field>

      <Field label="Notes (optional)" htmlFor="iv-notes">
        <Input id="iv-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <div className="flex items-center justify-between rounded-xl bg-surface px-4 py-3">
        <span className="text-sm font-medium text-ink-muted">Total</span>
        <span className="font-display text-lg font-bold text-ink">{formatKobo(totalKobo)}</span>
      </div>

      <div className="mt-1 flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1">
          Create invoice
        </Button>
      </div>
    </form>
  );
}
