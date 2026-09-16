"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import type { NewCustomerInput } from "@/lib/store";
import type { Customer } from "@/lib/types";

export function CustomerForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Save customer",
}: {
  initial?: Customer;
  onSubmit: (input: NewCustomerInput) => void;
  onCancel: () => void;
  submitLabel?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [gender, setGender] = useState<Customer["gender"]>(initial?.gender ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name, phone, email, gender, notes });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Name" htmlFor="c-name">
        <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </Field>
      <Field label="Phone" htmlFor="c-phone">
        <Input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 000 0000" required />
      </Field>
      <Field label="Email (optional)" htmlFor="c-email">
        <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Gender (optional)" htmlFor="c-gender">
        <Select id="c-gender" value={gender} onChange={(e) => setGender(e.target.value as Customer["gender"])}>
          <option value="">Not specified</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
        </Select>
      </Field>
      <Field label="Notes" htmlFor="c-notes" hint="Preferences, allergies, anything worth remembering.">
        <Textarea id="c-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="mt-1 flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
