"use client";

import { useState } from "react";
import { Pencil, Plus, Quote, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TestimonialForm } from "./testimonial-form";
import { useBusinessStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import type { Testimonial } from "@/lib/types";

/** Lives inside the Website settings page's own section (not a full page)
 * — testimonials save immediately through the same offline outbox as
 * services/products, independent of the page's "Save changes" button. */
export function TestimonialManager() {
  const testimonials = useBusinessStore((s) => s.data.testimonials);
  const addTestimonial = useBusinessStore((s) => s.addTestimonial);
  const updateTestimonial = useBusinessStore((s) => s.updateTestimonial);
  const deleteTestimonial = useBusinessStore((s) => s.deleteTestimonial);
  const showToast = useToastStore((s) => s.show);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [deleting, setDeleting] = useState<Testimonial | null>(null);

  return (
    <div className="border-t border-border pt-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-ink">Testimonials</p>
          <p className="mt-0.5 text-xs text-ink-muted">Shown on your website. Add a few of your best reviews.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add
        </Button>
      </div>

      {testimonials.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong p-4 text-center text-xs text-ink-muted">
          No testimonials yet — add one to build trust with visitors.
        </p>
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border">
          {testimonials.map((t) => (
            <div key={t.id} className="flex items-start gap-3 px-4 py-3.5">
              <Quote className="mt-0.5 size-4 shrink-0 text-ink-faint" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm text-ink">{t.quote}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
                  <span className="font-medium">{t.customerName}</span>
                  {t.rating ? (
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: t.rating }).map((_, i) => (
                        <Star key={i} className="size-3 fill-accent text-accent" />
                      ))}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => setEditing(t)} className="flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface" aria-label="Edit">
                  <Pencil className="size-4" />
                </button>
                <button onClick={() => setDeleting(t)} className="flex size-8 items-center justify-center rounded-lg text-danger hover:bg-danger-soft" aria-label="Delete">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add testimonial">
        <TestimonialForm
          onCancel={() => setAdding(false)}
          onSubmit={(input) => {
            addTestimonial(input);
            setAdding(false);
            showToast("Testimonial added");
          }}
        />
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit testimonial">
        {editing ? (
          <TestimonialForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(input) => {
              updateTestimonial(editing.id, input);
              setEditing(null);
              showToast("Testimonial updated");
            }}
          />
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={!!deleting}
        title="Delete this testimonial?"
        description="This can't be undone."
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            deleteTestimonial(deleting.id);
            showToast("Testimonial deleted");
          }
          setDeleting(null);
        }}
      />
    </div>
  );
}
