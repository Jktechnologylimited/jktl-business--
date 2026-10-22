"use client";

import { useState } from "react";
import { KeyRound, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToastStore } from "@/lib/toast";
import { deleteBusinessAccountAction, resetBusinessPasswordAction } from "@/lib/actions/admin-actions";

/**
 * Support actions for a business account.
 *
 * Two things an admin is asked for on a phone call: "I can't log in" and "please
 * close my account".
 *
 * **Reset** emails a one-time link to the owner. The admin never sees or sets a
 * password — the reset happens between the owner and their own inbox, so support
 * cannot become a way into somebody's account.
 *
 * **Delete** requires typing the business name. Every tenant table cascades from
 * `organizations`, so this removes the customers, bookings, sales, invoices, wallet
 * and contract with it, and there is no undo. A list of similarly named clinics is
 * exactly where a mis-click happens.
 */
export function BusinessRowActions({ organizationId, businessName }: { organizationId: string; businessName: string }) {
  const show = useToastStore((s) => s.show);
  const [busy, setBusy] = useState<"reset" | "delete" | "">("");
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");

  async function reset() {
    setBusy("reset");
    const result = await resetBusinessPasswordAction(organizationId);
    setBusy("");
    if (!result.ok) {
      show(result.error, "danger");
      return;
    }
    show(`Reset link sent to ${result.data.email}.`);
  }

  async function remove() {
    setBusy("delete");
    const result = await deleteBusinessAccountAction(organizationId, typed);
    setBusy("");
    if (!result.ok) {
      show(result.error, "danger");
      return;
    }
    show(`${businessName} deleted.`);
    window.location.reload();
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-1.5 rounded-lg border border-danger/40 bg-danger-soft p-2">
        <p className="text-[11px] font-medium text-danger">Type “{businessName}” to delete everything:</p>
        <Input value={typed} onChange={(e) => setTyped(e.target.value)} className="h-7 text-xs" placeholder={businessName} />
        <div className="flex gap-1.5">
          <Button size="sm" variant="danger" disabled={busy === "delete" || !typed.trim()} onClick={() => void remove()}>
            {busy === "delete" ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />} Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setConfirming(false); setTyped(""); }}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void reset()}
        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        title="Email the owner a one-time link to set a new password"
      >
        {busy === "reset" ? <Loader2 className="size-3 animate-spin" /> : <KeyRound className="size-3" />} Reset password
      </button>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1 text-xs font-medium text-danger hover:underline"
        title="Permanently delete this business and everything in it"
      >
        <Trash2 className="size-3" /> Delete
      </button>
    </div>
  );
}
