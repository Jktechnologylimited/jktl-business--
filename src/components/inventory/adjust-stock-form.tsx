"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import type { Product } from "@/lib/types";

export function AdjustStockForm({
  product,
  onSubmit,
  onCancel,
}: {
  product: Product;
  onSubmit: (delta: number, reason: string) => void;
  onCancel: () => void;
}) {
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const qty = Math.max(0, Number(quantity) || 0);
    if (qty === 0) return;
    onSubmit(direction === "add" ? qty : -qty, reason || (direction === "add" ? "Stock added" : "Stock correction"));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        {product.name} — currently <span className="font-medium text-ink">{product.stockQty}</span> in stock.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Direction" htmlFor="adj-dir">
          <Select id="adj-dir" value={direction} onChange={(e) => setDirection(e.target.value as "add" | "remove")}>
            <option value="add">Add stock</option>
            <option value="remove">Remove stock</option>
          </Select>
        </Field>
        <Field label="Quantity" htmlFor="adj-qty">
          <Input id="adj-qty" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </Field>
      </div>
      <Field label="Reason (optional)" htmlFor="adj-reason">
        <Input id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Restock from supplier" />
      </Field>
      <div className="mt-1 flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1">
          Save
        </Button>
      </div>
    </form>
  );
}
