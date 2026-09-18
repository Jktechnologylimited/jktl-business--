"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import type { BusinessProfilePatch } from "@/lib/store";
import type { BusinessProfile } from "@/lib/types";

export function BusinessForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: BusinessProfile;
  onSubmit: (patch: BusinessProfilePatch) => void;
  onCancel: () => void;
}) {
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [address, setAddress] = useState(initial.address);
  const [city, setCity] = useState(initial.city);
  const [state, setState] = useState(initial.state);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ displayName, phone, email, address, city, state });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Business name" htmlFor="biz-name">
        <Input id="biz-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required autoFocus />
      </Field>
      <Field label="Phone" htmlFor="biz-phone">
        <Input id="biz-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Field label="Email" htmlFor="biz-email">
        <Input id="biz-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Address" htmlFor="biz-address">
        <Input id="biz-address" value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City" htmlFor="biz-city">
          <Input id="biz-city" value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
        <Field label="State" htmlFor="biz-state">
          <Input id="biz-state" value={state} onChange={(e) => setState(e.target.value)} />
        </Field>
      </div>
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
