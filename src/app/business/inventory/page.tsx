"use client";

import { useMemo, useState } from "react";
import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { FilterTabs } from "@/components/app/filter-tabs";
import { EmptyState } from "@/components/app/empty-state";
import { StatusPill } from "@/components/app/status-pill";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { AdjustStockForm } from "@/components/inventory/adjust-stock-form";
import { useBusinessStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { formatShortDate } from "@/lib/format";
import type { Product } from "@/lib/types";

type Tab = "levels" | "movements";

const MOVEMENT_LABEL: Record<string, string> = {
  addition: "Added",
  deduction: "Removed",
  sale: "Sold",
  adjustment: "Adjusted",
};

export default function InventoryPage() {
  const products = useBusinessStore((s) => s.data.products);
  const movements = useBusinessStore((s) => s.data.movements);
  const adjustStock = useBusinessStore((s) => s.adjustStock);
  const showToast = useToastStore((s) => s.show);

  const [tab, setTab] = useState<Tab>("levels");
  const [adjusting, setAdjusting] = useState<Product | null>(null);

  const sortedMovements = useMemo(
    () => [...movements].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [movements],
  );

  if (products.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Inventory" />
        <EmptyState
          icon={<Boxes className="size-6 text-primary-strong" />}
          title="Nothing to track yet"
          description="Add products first — inventory tracks their stock automatically."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Inventory" />

      <FilterTabs<Tab>
        options={[
          { value: "levels", label: "Stock levels" },
          { value: "movements", label: "Movements" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "levels" ? (
        <div className="divide-y divide-border rounded-2xl border border-border">
          {products.map((p) => {
            const low = p.stockQty <= p.lowStockThreshold;
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{p.name}</div>
                  <div className="text-xs text-ink-muted">{p.category}</div>
                </div>
                {low ? <StatusPill tone="danger">Low</StatusPill> : null}
                <div className="w-16 shrink-0 text-right text-sm font-semibold text-ink">{p.stockQty}</div>
                <Button size="sm" variant="outline" onClick={() => setAdjusting(p)}>
                  Adjust
                </Button>
              </div>
            );
          })}
        </div>
      ) : sortedMovements.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">No stock movements yet.</p>
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border">
          {sortedMovements.map((m) => {
            const product = products.find((p) => p.id === m.productId);
            return (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{product?.name ?? "Unknown product"}</div>
                  <div className="truncate text-xs text-ink-muted">
                    {m.reason} · {formatShortDate(m.createdAt)}
                  </div>
                </div>
                <div className={`shrink-0 text-sm font-semibold ${m.quantity >= 0 ? "text-primary" : "text-danger"}`}>
                  {m.quantity >= 0 ? "+" : ""}
                  {m.quantity}
                </div>
                <div className="w-16 shrink-0 text-right text-xs text-ink-muted">{MOVEMENT_LABEL[m.type] ?? m.type}</div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={!!adjusting} onClose={() => setAdjusting(null)} title="Adjust stock">
        {adjusting ? (
          <AdjustStockForm
            product={adjusting}
            onCancel={() => setAdjusting(null)}
            onSubmit={(delta, reason) => {
              adjustStock(adjusting.id, delta, reason);
              setAdjusting(null);
              showToast("Stock updated");
            }}
          />
        ) : null}
      </Sheet>
    </div>
  );
}
