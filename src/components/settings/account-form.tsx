"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import type { AccountPatch } from "@/lib/store";
import type { AppUser } from "@/lib/types";

export function AccountForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: AppUser;
  onSubmit: (patch: AccountPatch) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name, email, phone });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Name" htmlFor="acc-name">
        <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </Field>
      <Field label="Email" htmlFor="acc-email">
        <Input id="acc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Phone" htmlFor="acc-phone">
        <Input id="acc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
      </Field>
      <div className="mt-1 flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1">
          Save changes
        </Button>
      </div>
    </form>
  );
}
