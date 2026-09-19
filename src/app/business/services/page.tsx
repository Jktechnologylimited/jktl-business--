"use client";

import { useState } from "react";
import { Pencil, Plus, Scissors, Sparkles, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { FilterTabs } from "@/components/app/filter-tabs";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ServiceForm } from "@/components/services/service-form";
import { useBusinessStore, useCurrentIndustry } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { formatKobo } from "@/lib/format";
import type { Service } from "@/lib/types";

export default function ServicesPage() {
  const services = useBusinessStore((s) => s.data.services);
  const addService = useBusinessStore((s) => s.addService);
  const updateService = useBusinessStore((s) => s.updateService);
  const deleteService = useBusinessStore((s) => s.deleteService);
  const showToast = useToastStore((s) => s.show);
  const industry = useCurrentIndustry();

  const [category, setCategory] = useState("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState<Service | null>(null);

  const tabs = [{ value: "all", label: "All" }, ...industry.serviceCategories.map((c) => ({ value: c, label: c }))];
  const filtered = category === "all" ? services : services.filter((s) => s.category === category);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Services"
        action={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add
          </Button>
        }
      />

      {services.length > 0 ? <FilterTabs options={tabs} value={category} onChange={setCategory} /> : null}

      {services.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-6 text-primary-strong" />}
          title="No services yet"
          description="Add the services you offer so you can book and sell them."
          action={<Button onClick={() => setAdding(true)}>Add service</Button>}
        />
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">No services in this category yet.</p>
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border">
          {filtered.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3.5">
              {s.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL or hosted URL, not a static asset
                <img src={s.imageUrl} alt="" className="size-10 shrink-0 rounded-lg border border-border object-cover" />
              ) : (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-strong text-ink-faint">
                  <Scissors className="size-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">{s.name}</span>
                  {!s.active ? (
                    <span className="rounded-full bg-surface-strong px-2 py-0.5 text-[11px] font-medium text-ink-muted">Inactive</span>
                  ) : null}
                </div>
                <div className="text-xs text-ink-muted">
                  {s.category} · {s.durationMin} min
                </div>
              </div>
              <div className="shrink-0 text-sm font-semibold text-ink">{formatKobo(s.priceKobo)}</div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => setEditing(s)} className="flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface" aria-label="Edit">
                  <Pencil className="size-4" />
                </button>
                <button onClick={() => setDeleting(s)} className="flex size-8 items-center justify-center rounded-lg text-danger hover:bg-danger-soft" aria-label="Delete">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add service">
        <ServiceForm
          categories={industry.serviceCategories}
          onCancel={() => setAdding(false)}
          onSubmit={(input) => {
            addService(input);
            setAdding(false);
            showToast(`${input.name} added`);
          }}
        />
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit service">
        {editing ? (
          <ServiceForm
            initial={editing}
            categories={industry.serviceCategories}
            onCancel={() => setEditing(null)}
            onSubmit={(input) => {
              updateService(editing.id, input);
              setEditing(null);
              showToast("Service updated");
            }}
          />
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.name}?`}
        description="This can't be undone. Past bookings and sales keep their own record of the price."
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            deleteService(deleting.id);
            showToast("Service deleted");
          }
          setDeleting(null);
        }}
      />
    </div>
  );
}
