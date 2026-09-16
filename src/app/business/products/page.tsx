"use client";

import { useMemo, useState } from "react";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { SearchInput } from "@/components/app/search-input";
import { EmptyState } from "@/components/app/empty-state";
import { StatusPill } from "@/components/app/status-pill";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProductForm } from "@/components/products/product-form";
import { useBusinessStore, useCurrentIndustry } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { formatKobo } from "@/lib/format";
import type { Product } from "@/lib/types";

export default function ProductsPage() {
  const products = useBusinessStore((s) => s.data.products);
  const addProduct = useBusinessStore((s) => s.addProduct);
  const updateProduct = useBusinessStore((s) => s.updateProduct);
  const deleteProduct = useBusinessStore((s) => s.deleteProduct);
  const showToast = useToastStore((s) => s.show);
  const industry = useCurrentIndustry();

  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, query]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Products"
        action={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add
          </Button>
        }
      />

      {products.length > 0 ? <SearchInput value={query} onChange={setQuery} placeholder="Search by name or SKU" /> : null}

      {products.length === 0 ? (
        <EmptyState
          icon={<Package className="size-6 text-primary-strong" />}
          title="No products yet"
          description="Add retail products to sell and track alongside your services."
          action={<Button onClick={() => setAdding(true)}>Add product</Button>}
        />
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">No products match &quot;{query}&quot;.</p>
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border">
          {filtered.map((p) => {
            const low = p.stockQty <= p.lowStockThreshold;
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{p.name}</div>
                  <div className="truncate text-xs text-ink-muted">
                    {p.sku} · {p.category} · {p.stockQty} in stock
                  </div>
                </div>
                {low ? <StatusPill tone="danger">Low stock</StatusPill> : null}
                <div className="shrink-0 text-sm font-semibold text-ink">{formatKobo(p.priceKobo)}</div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => setEditing(p)} className="flex size-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface" aria-label="Edit">
                    <Pencil className="size-4" />
                  </button>
                  <button onClick={() => setDeleting(p)} className="flex size-8 items-center justify-center rounded-lg text-danger hover:bg-danger-soft" aria-label="Delete">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add product">
        <ProductForm
          categories={industry.productCategories}
          onCancel={() => setAdding(false)}
          onSubmit={(input) => {
            addProduct(input);
            setAdding(false);
            showToast(`${input.name} added`);
          }}
        />
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit product">
        {editing ? (
          <ProductForm
            initial={editing}
            categories={industry.productCategories}
            onCancel={() => setEditing(null)}
            onSubmit={(input) => {
              updateProduct(editing.id, input);
              setEditing(null);
              showToast("Product updated");
            }}
          />
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.name}?`}
        description="This can't be undone."
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            deleteProduct(deleting.id);
            showToast("Product deleted");
          }
          setDeleting(null);
        }}
      />
    </div>
  );
}
