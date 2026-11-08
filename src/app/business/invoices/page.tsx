"use client";
import { T } from "@/components/i18n/LanguageProvider";

import { useEffect, useMemo, useState } from "react";
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
import { getPaymentSettingsAction } from "@/lib/actions/payment-settings-actions";
import { payoutReady } from "@/lib/invoicing/policy";
import type { InvoiceStatus } from "@/lib/types";

type Tab = "all" | InvoiceStatus;

export default function InvoicesPage() {
  const data = useBusinessStore((s) => s.data);
  const addInvoice = useBusinessStore((s) => s.addInvoice);
  const showToast = useToastStore((s) => s.show);

  const mode = useBusinessStore((s) => s.mode);
  const [bank, setBank] = useState<{
    ready: boolean;
    error: string;
    loaded: boolean;
  }>({ ready: false, error: "", loaded: false });
  const [checking, setChecking] = useState(false);
  async function checkBank() {
    setChecking(true);
    try {
      const r = await getPaymentSettingsAction();
      setBank(
        r.ok
          ? { ready: payoutReady(r.data), error: "", loaded: true }
          : { ready: false, error: r.error, loaded: true },
      );
    } catch {
      setBank({
        ready: false,
        error: "Could not check your receiving account. Please retry.",
        loaded: true,
      });
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    if (mode !== "live") return;
    let active = true;
    void getPaymentSettingsAction()
      .then((r) => {
        if (active)
          setBank(
            r.ok
              ? { ready: payoutReady(r.data), error: "", loaded: true }
              : { ready: false, error: r.error, loaded: true },
          );
      })
      .catch(() => {
        if (active)
          setBank({
            ready: false,
            error: "Could not check payment settings. Please retry.",
            loaded: true,
          });
      });
    return () => {
      active = false;
    };
  }, [mode, data.organization.id]);
  const canCreate =
    data.customers.length > 0 && (mode !== "live" || bank.ready);
  const [tab, setTab] = useState<Tab>("all");
  const [adding, setAdding] = useState(false);

  const sorted = useMemo(
    () =>
      [...data.invoices].sort(
        (a, b) =>
          new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime(),
      ),
    [data.invoices],
  );
  const filtered =
    tab === "all" ? sorted : sorted.filter((i) => i.status === tab);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Invoices"
        action={
          <Button
            size="sm"
            onClick={() => setAdding(true)}
            disabled={!canCreate}
          >
            <Plus className="size-4" />
            <T>Create</T>
          </Button>
        }
      />

      {mode === "live" && !bank.ready && (
        <section
          className="rounded-2xl border border-primary/30 bg-surface p-5 space-y-3"
          aria-label="Receiving bank account"
        >
          <h2 className="font-semibold">Set up your receiving bank account</h2>
          <p className="text-sm text-ink-muted">
            Verify and save your bank details before creating invoices. Customer
            payments are routed through Paystack to this account, with
            settlement on Paystack’s schedule.
          </p>
          <p role="status" className="text-sm">
            {bank.error ||
              (bank.loaded
                ? "A verified receiving account is required."
                : "Checking payment setup…")}
          </p>
          <div className="flex flex-wrap gap-4 items-center">
            <Link
              className="rounded-xl bg-primary px-4 py-3 font-semibold text-white"
              href="/business/settings?tab=payments"
            >
              Add bank account
            </Link>
            <button
              type="button"
              disabled={checking}
              className="text-sm underline"
              onClick={checkBank}
            >
              {checking ? "Checking…" : "Check again"}
            </button>
          </div>
        </section>
      )}
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
            <Button onClick={() => setAdding(true)} disabled={!canCreate}>
              <T>Create invoice</T>
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">
          <T>Nothing here.</T>
        </p>
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border">
          {filtered.map((inv) => {
            const meta = invoiceStatusMeta(inv.status);
            return (
              <Link
                key={inv.id}
                href={`/business/invoices/${inv.id}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">
                    {inv.number} ·{" "}
                    {customerName(data.customers, inv.customerId)}
                  </div>
                  <div className="text-xs text-ink-muted">
                    <T>Due </T>
                    {formatShortDate(inv.dueDate)}
                  </div>
                </div>
                <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                <div className="w-24 shrink-0 text-right text-sm font-semibold text-ink">
                  {formatKobo(inv.totalKobo)}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title="Create invoice"
      >
        <InvoiceForm
          customers={data.customers}
          onCancel={() => setAdding(false)}
          onSubmit={async (input) => {
            await addInvoice(input);
            setAdding(false);
            showToast("Invoice created");
          }}
        />
      </Sheet>
    </div>
  );
}
