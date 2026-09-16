"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { SearchInput } from "@/components/app/search-input";
import { EmptyState } from "@/components/app/empty-state";
import { ListSkeleton } from "@/components/app/skeleton";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { CustomerForm } from "@/components/customers/customer-form";
import { useBusinessStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { initials, formatShortDate } from "@/lib/format";

export default function CustomersPage() {
  const customers = useBusinessStore((s) => s.data.customers);
  const addCustomer = useBusinessStore((s) => s.addCustomer);
  const showToast = useToastStore((s) => s.show);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [customers, query]);

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Customers" />
        <ListSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Customers"
        action={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add
          </Button>
        }
      />

      {customers.length > 0 ? <SearchInput value={query} onChange={setQuery} placeholder="Search by name or phone" /> : null}

      {customers.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6 text-primary-strong" />}
          title="No customers yet"
          description="Add your first customer to start building your salon's customer history."
          action={<Button onClick={() => setAdding(true)}>Add customer</Button>}
        />
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">No customers match &quot;{query}&quot;.</p>
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border">
          {filtered.map((c) => (
            <Link key={c.id} href={`/business/customers/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-strong">
                {initials(c.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{c.name}</div>
                <div className="truncate text-xs text-ink-muted">{c.phone}</div>
              </div>
              <div className="shrink-0 text-xs text-ink-faint">Since {formatShortDate(c.createdAt)}</div>
            </Link>
          ))}
        </div>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add customer">
        <CustomerForm
          onCancel={() => setAdding(false)}
          onSubmit={(input) => {
            addCustomer(input);
            setAdding(false);
            showToast(`${input.name} added`);
          }}
        />
      </Sheet>
    </div>
  );
}
