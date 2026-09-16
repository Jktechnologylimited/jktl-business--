"use client";

import { useMemo, useState } from "react";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { FilterTabs } from "@/components/app/filter-tabs";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { useBusinessStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { formatKobo, formatShortDate } from "@/lib/format";
import type { Expense } from "@/lib/types";

type Cat = "all" | Expense["category"];

const CATEGORIES: Expense["category"][] = ["rent", "electricity", "staff", "supplies", "transportation", "marketing", "other"];

export default function ExpensesPage() {
  const expenses = useBusinessStore((s) => s.data.expenses);
  const addExpense = useBusinessStore((s) => s.addExpense);
  const deleteExpense = useBusinessStore((s) => s.deleteExpense);
  const showToast = useToastStore((s) => s.show);

  const [category, setCategory] = useState<Cat>("all");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Expense | null>(null);

  const sorted = useMemo(() => [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [expenses]);
  const filtered = category === "all" ? sorted : sorted.filter((e) => e.category === category);
  const total = filtered.reduce((sum, e) => sum + e.amountKobo, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Expenses"
        action={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add
          </Button>
        }
      />

      {expenses.length > 0 ? (
        <FilterTabs<Cat>
          options={[{ value: "all", label: "All" }, ...CATEGORIES.map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) }))]}
          value={category}
          onChange={setCategory}
        />
      ) : null}

      {expenses.length === 0 ? (
        <EmptyState
          icon={<Receipt className="size-6 text-primary-strong" />}
          title="No expenses recorded yet"
          description="Track rent, staff, supplies and other costs to see your real margin."
          action={<Button onClick={() => setAdding(true)}>Add expense</Button>}
        />
      ) : (
        <>
          <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3">
            <span className="text-sm font-medium text-ink-muted">Total{category !== "all" ? ` · ${category}` : ""}</span>
            <span className="font-display text-lg font-bold text-ink">{formatKobo(total)}</span>
          </div>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-muted">Nothing in this category yet.</p>
          ) : (
            <div className="divide-y divide-border rounded-2xl border border-border">
              {filtered.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{e.description}</div>
                    <div className="text-xs text-ink-muted">
                      {e.category[0].toUpperCase() + e.category.slice(1)} · {formatShortDate(e.date)} · {e.paymentMethod.toUpperCase()}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold text-ink">{formatKobo(e.amountKobo)}</div>
                  <button onClick={() => setDeleting(e)} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-danger-soft" aria-label="Delete">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add expense">
        <ExpenseForm
          onCancel={() => setAdding(false)}
          onSubmit={(input) => {
            addExpense(input);
            setAdding(false);
            showToast("Expense added");
          }}
        />
      </Sheet>

      <ConfirmDialog
        open={!!deleting}
        title="Delete this expense?"
        description="This can't be undone."
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            deleteExpense(deleting.id);
            showToast("Expense deleted");
          }
          setDeleting(null);
        }}
      />
    </div>
  );
}
