"use client";

import { useMemo, useState } from "react";
import { Banknote, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { SearchInput } from "@/components/app/search-input";
import { EmptyState } from "@/components/app/empty-state";
import { StatusPill, paymentStatusMeta } from "@/components/app/status-pill";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { SaleForm } from "@/components/sales/sale-form";
import { useBusinessStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { customerName } from "@/lib/selectors";
import { formatKobo, formatShortDate, formatTime } from "@/lib/format";

export default function SalesPage() {
  const data = useBusinessStore((s) => s.data);
  const addSale = useBusinessStore((s) => s.addSale);
  const showToast = useToastStore((s) => s.show);

  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const sorted = useMemo(
    () => [...data.sales].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [data.sales],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((s) => customerName(data.customers, s.customerId).toLowerCase().includes(q));
  }, [sorted, data.customers, query]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Sales"
        action={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> New sale
          </Button>
        }
      />

      {data.sales.length > 0 ? <SearchInput value={query} onChange={setQuery} placeholder="Search by customer" /> : null}

      {data.sales.length === 0 ? (
        <EmptyState
          icon={<Banknote className="size-6 text-primary-strong" />}
          title="No sales recorded yet"
          description="Record your first sale to start tracking revenue."
          action={<Button onClick={() => setAdding(true)}>Record sale</Button>}
        />
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">No sales match &quot;{query}&quot;.</p>
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border">
          {filtered.map((s) => {
            const meta = paymentStatusMeta(s.paymentStatus);
            return (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{customerName(data.customers, s.customerId)}</div>
                  <div className="text-xs text-ink-muted">
                    {formatShortDate(s.createdAt)}, {formatTime(s.createdAt)} · {s.paymentMethod.toUpperCase()}
                  </div>
                </div>
                <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                <div className="w-24 shrink-0 text-right text-sm font-semibold text-ink">{formatKobo(s.totalKobo)}</div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="New sale">
        <SaleForm
          customers={data.customers}
          services={data.services}
          products={data.products}
          onCancel={() => setAdding(false)}
          onSubmit={(input) => {
            addSale(input);
            setAdding(false);
            showToast("Sale recorded");
          }}
        />
      </Sheet>
    </div>
  );
}
