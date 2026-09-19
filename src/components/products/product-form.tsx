"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { ProductPhotoField } from "./product-photo-field";
import type { NewProductInput } from "@/lib/store";
import { koboToNaira, nairaToKobo } from "@/lib/format";
import type { Product } from "@/lib/types";

export function ProductForm({
  initial,
  categories,
  onSubmit,
  onCancel,
}: {
  initial?: Product;
  categories: string[];
  onSubmit: (input: NewProductInput) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [category, setCategory] = useState(initial?.category ?? categories[0] ?? "");
  const [cost, setCost] = useState(initial ? String(koboToNaira(initial.costKobo)) : "");
  const [price, setPrice] = useState(initial ? String(koboToNaira(initial.priceKobo)) : "");
  const [stockQty, setStockQty] = useState(initial ? String(initial.stockQty) : "0");
  const [threshold, setThreshold] = useState(initial ? String(initial.lowStockThreshold) : "5");
  const [supplier, setSupplier] = useState(initial?.supplier ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      sku,
      category,
      costKobo: nairaToKobo(Number(cost) || 0),
      priceKobo: nairaToKobo(Number(price) || 0),
      stockQty: Number(stockQty) || 0,
      lowStockThreshold: Number(threshold) || 0,
      supplier,
      active,
      imageUrl,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Photo" htmlFor="pr-photo">
        <ProductPhotoField value={imageUrl} onChange={setImageUrl} />
      </Field>
      <Field label="Product name" htmlFor="pr-name">
        <Input id="pr-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="SKU" htmlFor="pr-sku">
          <Input id="pr-sku" value={sku} onChange={(e) => setSku(e.target.value)} required />
        </Field>
        <Field label="Category" htmlFor="pr-cat">
          <Input id="pr-cat" list="pr-categories" value={category} onChange={(e) => setCategory(e.target.value)} required />
          <datalist id="pr-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cost price (₦)" htmlFor="pr-cost">
          <Input id="pr-cost" type="number" min="0" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} required />
        </Field>
        <Field label="Selling price (₦)" htmlFor="pr-price">
          <Input id="pr-price" type="number" min="0" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Stock quantity" htmlFor="pr-stock">
          <Input id="pr-stock" type="number" min="0" inputMode="numeric" value={stockQty} onChange={(e) => setStockQty(e.target.value)} required />
        </Field>
        <Field label="Low-stock alert at" htmlFor="pr-threshold">
          <Input id="pr-threshold" type="number" min="0" inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} required />
        </Field>
      </div>
      <Field label="Supplier (optional)" htmlFor="pr-supplier">
        <Input id="pr-supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 rounded border-border-strong" />
        Active — available for sale
      </label>
      <div className="mt-1 flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1">
          Save product
        </Button>
      </div>
    </form>
  );
}
