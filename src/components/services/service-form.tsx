"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import type { NewServiceInput } from "@/lib/store";
import { koboToNaira, nairaToKobo } from "@/lib/format";
import type { Service } from "@/lib/types";

export function ServiceForm({
  initial,
  categories,
  cancelLabel = "Cancel",
  onSubmit,
  onCancel,
}: {
  initial?: Service;
  categories: string[];
  cancelLabel?: string;
  onSubmit: (input: NewServiceInput) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? categories[0] ?? "");
  const [price, setPrice] = useState(initial ? String(koboToNaira(initial.priceKobo)) : "");
  const [duration, setDuration] = useState(initial ? String(initial.durationMin) : "30");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [active, setActive] = useState(initial?.active ?? true);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      category,
      priceKobo: nairaToKobo(Number(price) || 0),
      durationMin: Number(duration) || 0,
      description,
      active,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Service name" htmlFor="sv-name">
        <Input id="sv-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </Field>
      <Field label="Category" htmlFor="sv-cat">
        <Input id="sv-cat" list="sv-categories" value={category} onChange={(e) => setCategory(e.target.value)} required />
        <datalist id="sv-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Price (₦)" htmlFor="sv-price">
          <Input id="sv-price" type="number" min="0" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </Field>
        <Field label="Duration (min)" htmlFor="sv-duration">
          <Input id="sv-duration" type="number" min="0" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} required />
        </Field>
      </div>
      <Field label="Description (optional)" htmlFor="sv-desc">
        <Textarea id="sv-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 rounded border-border-strong" />
        Active — bookable by customers
      </label>
      <div className="mt-1 flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button type="submit" className="flex-1">
          Save service
        </Button>
      </div>
    </form>
  );
}
