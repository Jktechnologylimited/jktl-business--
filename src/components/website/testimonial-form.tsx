"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import type { NewTestimonialInput } from "@/lib/store";
import type { Testimonial } from "@/lib/types";

/** Owner-entered testimonial — see CHECKPOINT.md for why there's no public
 * submission form here (deliberate: no moderation queue needed this way). */
export function TestimonialForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Testimonial;
  onSubmit: (input: NewTestimonialInput) => void;
  onCancel: () => void;
}) {
  const [customerName, setCustomerName] = useState(initial?.customerName ?? "");
  const [quote, setQuote] = useState(initial?.quote ?? "");
  const [rating, setRating] = useState<number | null>(initial?.rating ?? 5);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ customerName, quote, rating });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Customer name" htmlFor="ts-name">
        <Input id="ts-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required autoFocus />
      </Field>
      <Field label="What they said" htmlFor="ts-quote">
        <Textarea id="ts-quote" rows={3} value={quote} onChange={(e) => setQuote(e.target.value)} maxLength={300} required />
      </Field>
      <Field label="Rating (optional)" htmlFor="ts-rating">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(rating === n ? null : n)}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              className="p-0.5"
            >
              <Star className={`size-5 ${rating !== null && n <= rating ? "fill-accent text-accent" : "text-border-strong"}`} />
            </button>
          ))}
          {rating !== null ? (
            <button type="button" onClick={() => setRating(null)} className="ml-2 text-xs text-ink-muted hover:text-danger">
              Clear
            </button>
          ) : null}
        </div>
      </Field>
      <div className="mt-1 flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1">
          Save testimonial
        </Button>
      </div>
    </form>
  );
}
