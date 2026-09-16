"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { FilterTabs } from "@/components/app/filter-tabs";
import { EmptyState } from "@/components/app/empty-state";
import { StatusPill, invoiceStatusMeta } from "@/components/app/status-pill";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { useBusinessStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { customerName } from "@/lib/selectors";
import { formatKobo, formatShortDate } from "@/lib/format";
import type { InvoiceStatus } from "@/lib/types";

type Tab = "all" | InvoiceStatus;

export default function InvoicesPage() {
  const data = useBusinessStore((s) => s.data);
  const addInvoice = useBusinessStore((s) => s.addInvoice);
  const showToast = useToastStore((s) => s.show);

  const [tab, setTab] = useState<Tab>("all");
  const [adding, setAdding] = useState(false);

  const sorted = useMemo(
    () => [...data.invoices].sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()),
    [data.invoices],
  );
  const filtered = tab === "all" ? sorted : sorted.filter((i) => i.status === tab);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Invoices"
        action={
          <Button size="sm" onClick={() => setAdding(true)} disabled={data.customers.length === 0}>
            <Plus className="size-4" /> Create
          </Button>
        }
      />

      {data.invoices.length > 0 ? (
        <FilterTabs<Tab>
          options={[
            { value: "all", label: "All" },
            { value: "draft", label: "Draft" },
            { value: "pending", label: "Pending" },
            { value: "paid", label: "Paid" },
            { value: "overdue", label: "Overdue" },
          ]}
          value={tab}
          onChange={setTab}
        />
      ) : null}

      {data.invoices.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-6 text-primary-strong" />}
          title="No invoices yet"
          description="Create an invoice for a customer to track what they owe you."
          action={
            <Button onClick={() => setAdding(true)} disabled={data.customers.length === 0}>
              Create invoice
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">Nothing here.</p>
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border">
          {filtered.map((inv) => {
            const meta = invoiceStatusMeta(inv.status);
            return (
              <Link key={inv.id} href={`/business/invoices/${inv.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">
                    {inv.number} · {customerName(data.customers, inv.customerId)}
                  </div>
                  <div className="text-xs text-ink-muted">Due {formatShortDate(inv.dueDate)}</div>
                </div>
                <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                <div className="w-24 shrink-0 text-right text-sm font-semibold text-ink">{formatKobo(inv.totalKobo)}</div>
              </Link>
            );
          })}
        </div>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Create invoice">
        <InvoiceForm
          customers={data.customers}
          onCancel={() => setAdding(false)}
          onSubmit={(input) => {
            addInvoice(input);
            setAdding(false);
            showToast("Invoice created");
          }}
        />
      </Sheet>
    </div>
  );
}
