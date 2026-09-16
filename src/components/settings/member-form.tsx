"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import type { NewMemberInput } from "@/lib/store";

export function MemberForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (input: NewMemberInput) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<NewMemberInput["role"]>("staff");
  const [title, setTitle] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name, email, role, title: title || (role === "manager" ? "Manager" : "Staff") });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Name" htmlFor="mem-name">
        <Input id="mem-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </Field>
      <Field label="Email" htmlFor="mem-email">
        <Input id="mem-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Role" htmlFor="mem-role">
          <Select id="mem-role" value={role} onChange={(e) => setRole(e.target.value as NewMemberInput["role"])}>
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
          </Select>
        </Field>
        <Field label="Title" htmlFor="mem-title" hint="e.g. Stylist, Front Desk">
          <Input id="mem-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
      </div>
      <p className="text-xs text-ink-muted">
        This adds them to your team list. Sending a real invite email happens once JKTL Business is connected to
        Resend.
      </p>
      <div className="mt-1 flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1">
          Add member
        </Button>
      </div>
    </form>
  );
}
