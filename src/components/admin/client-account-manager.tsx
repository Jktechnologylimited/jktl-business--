"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, MailPlus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/format";
import { useToastStore } from "@/lib/toast";
import { createAccountForClientAction } from "@/lib/actions/prospect-actions";
import type { ExistingClient } from "@/lib/db/prospects";

/**
 * Creates and invites accounts for existing JKTL clients.
 *
 * One row per business, with the action that matters: make them a tenant and send
 * the invite. The invite is a password-reset link, so no password is generated for
 * transmission and there is no second auth path to maintain.
 */
export function ClientAccountManager({ clients }: { clients: ExistingClient[] }) {
  const show = useToastStore((s) => s.show);
  const [busy, setBusy] = useState("");
  const [done, setDone] = useState<Record<string, string>>({});

  async function invite(client: ExistingClient) {
    setBusy(client.id);
    const result = await createAccountForClientAction(client.id);
    setBusy("");
    if (!result.ok) {
      show(result.error, "danger");
      return;
    }
    setDone((prev) => ({ ...prev, [client.id]: result.data.email }));
    show(`Account created — invite sent to ${result.data.email}.`);
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-paper p-5 text-sm text-ink-muted">
        No existing clients marked yet. Mark a lead as an existing JKTL client from the lead engine, then it appears
        here for onboarding instead of going into the cold sequence.
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-paper p-4">
      <ul className="divide-y divide-border">
        {clients.map((client) => {
          const hasAccount = Boolean(client.accountOrganizationId) || Boolean(done[client.id]);
          return (
            <li key={client.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{client.businessName}</p>
                <p className="text-xs text-ink-muted">
                  {client.businessEmail || client.email || "no email on file"}
                  {client.city ? ` · ${client.city}` : ""}
                </p>
                {client.website ? (
                  <p className="truncate text-[11px] text-ink-faint">{client.website}</p>
                ) : null}
                {client.invitedAt ? (
                  <p className="text-[11px] text-ink-faint">Invited {formatShortDate(client.invitedAt)}</p>
                ) : null}
              </div>

              {hasAccount ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                  <CheckCircle2 className="size-3.5" /> Account created
                </span>
              ) : (
                <Button size="sm" disabled={busy === client.id} onClick={() => void invite(client)}>
                  {busy === client.id ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                  Create account &amp; invite
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-3 flex items-start gap-1.5 text-[11px] text-ink-faint">
        <MailPlus className="mt-0.5 size-3 shrink-0" />
        The invite links to the password page and works once, for seven days. Creating an account is claimed atomically,
        so two admins working this list cannot make two tenants for one business.
      </p>
    </section>
  );
}
