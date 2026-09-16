"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Pencil, Phone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusPill, bookingStatusMeta } from "@/components/app/status-pill";
import { CustomerForm } from "@/components/customers/customer-form";
import { useBusinessStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { customerHistory } from "@/lib/selectors";
import { formatKobo, formatShortDate, initials } from "@/lib/format";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const showToast = useToastStore((s) => s.show);
  const data = useBusinessStore((s) => s.data);
  const updateCustomer = useBusinessStore((s) => s.updateCustomer);
  const deleteCustomer = useBusinessStore((s) => s.deleteCustomer);

  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const customer = data.customers.find((c) => c.id === params.id);
  const history = useMemo(() => (customer ? customerHistory(data, customer.id) : []), [data, customer]);

  if (!customer) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-ink-muted">This customer no longer exists.</p>
        <Link href="/business/customers" className="text-sm font-medium text-primary">
          Back to customers
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/business/customers" className="flex w-fit items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Customers
      </Link>

      <div className="flex items-start gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent-strong">
          {initials(customer.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-bold tracking-tight text-ink">{customer.name}</h1>
          <div className="mt-1 flex flex-col gap-0.5 text-sm text-ink-muted">
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5" /> {customer.phone}
            </span>
            {customer.email ? (
              <span className="flex items-center gap-1.5">
                <Mail className="size-3.5" /> {customer.email}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="icon" onClick={() => setEditing(true)} aria-label="Edit">
            <Pencil className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setConfirmingDelete(true)} aria-label="Delete">
            <Trash2 className="size-4 text-danger" />
          </Button>
        </div>
      </div>

      {customer.notes ? (
        <div className="rounded-2xl bg-surface p-4 text-sm text-ink">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">Notes</div>
          {customer.notes}
        </div>
      ) : null}

      <section>
        <h2 className="mb-3 font-display text-base font-semibold text-ink">Visit history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-ink-muted">No bookings or sales recorded yet.</p>
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border">
            {history.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-ink">{item.label}</div>
                  <div className="text-xs text-ink-muted">{formatShortDate(item.at)}</div>
                </div>
                {item.kind === "booking" ? (
                  <StatusPill tone={bookingStatusMeta(item.status).tone}>{bookingStatusMeta(item.status).label}</StatusPill>
                ) : (
                  <span className="text-sm font-semibold text-ink">{formatKobo(item.totalKobo)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Edit customer">
        <CustomerForm
          initial={customer}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSubmit={(input) => {
            updateCustomer(customer.id, input);
            setEditing(false);
            showToast("Customer updated");
          }}
        />
      </Sheet>

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete ${customer.name}?`}
        description="This removes the customer record. Their past bookings and sales stay on record."
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          deleteCustomer(customer.id);
          showToast("Customer deleted");
          router.push("/business/customers");
        }}
      />
    </div>
  );
}
