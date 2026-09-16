"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import type { NewExpenseInput } from "@/lib/store";
import { nairaToKobo } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";

const CATEGORIES: NewExpenseInput["category"][] = [
  "rent",
  "electricity",
  "staff",
  "supplies",
  "transportation",
  "marketing",
  "other",
];

export function ExpenseForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (input: NewExpenseInput) => void;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<NewExpenseInput["category"]>("supplies");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      description,
      category,
      amountKobo: nairaToKobo(Number(amount) || 0),
      paymentMethod,
      date: new Date(date).toISOString(),
      notes,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Description" htmlFor="ex-desc">
        <Input id="ex-desc" value={description} onChange={(e) => setDescription(e.target.value)} required autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" htmlFor="ex-cat">
          <Select id="ex-cat" value={category} onChange={(e) => setCategory(e.target.value as NewExpenseInput["category"])}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c[0].toUpperCase() + c.slice(1)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount (₦)" htmlFor="ex-amount">
          <Input id="ex-amount" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Payment method" htmlFor="ex-method">
          <Select id="ex-method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
            <option value="cash">Cash</option>
            <option value="transfer">Transfer</option>
            <option value="pos">POS</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Date" htmlFor="ex-date">
          <Input id="ex-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
      </div>
      <Field label="Notes (optional)" htmlFor="ex-notes">
        <Textarea id="ex-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="mt-1 flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1">
          Save expense
        </Button>
      </div>
    </form>
  );
}
