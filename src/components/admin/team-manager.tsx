"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck, Trash2, UserPlus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/app/field";
import { formatShortDate } from "@/lib/format";
import { useToastStore } from "@/lib/toast";
import { ROLE_DESCRIPTION, ROLE_LABEL, type AdminRole } from "@/lib/admin-permissions";
import { createAdminTeamMemberAction, deleteAdminAccountAction, resetAdminPasswordAction, setAdminDisabledAction } from "@/lib/actions/admin-actions";
import type { AdminTeamMember } from "@/lib/db/admin-auth";

/**
 * Creates and disables command-centre accounts.
 *
 * The password is typed by the owner and shown back once, then never again — it is
 * deliberately not emailed. An emailed password lives in a mailbox forever and, in
 * practice, is never changed.
 */
export function TeamManager({ team }: { team: AdminTeamMember[] }) {
  const show = useToastStore((s) => s.show);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole>("affiliate_manager");
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState("");
  const [created, setCreated] = useState<{ email: string; role: AdminRole } | null>(null);
  /** Which account is having its password reset, and the new value — shown once. */
  const [resetting, setResetting] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [revealed, setRevealed] = useState<{ email: string; password: string } | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setCreated(null);
    const result = await createAdminTeamMemberAction({ name, email, password, role });
    setPending(false);
    if (!result.ok) {
      show(result.error, "danger");
      return;
    }
    setCreated({ email: result.data.email, role: result.data.role });
    setName("");
    setEmail("");
    setPassword("");
    show("Account created. Share the password with them directly.");
    // The list is server-rendered; a reload is the simplest way to show the new row.
    window.location.reload();
  }

  async function resetPassword(member: AdminTeamMember) {
    setBusy(member.id);
    const result = await resetAdminPasswordAction(member.id, newPassword);
    setBusy("");
    if (!result.ok) {
      show(result.error, "danger");
      return;
    }
    // Shown once, here, and never emailed — same reason as account creation.
    setRevealed({ email: member.email, password: newPassword });
    setResetting("");
    setNewPassword("");
    show("Password changed and their sessions signed out.");
  }

  async function remove(member: AdminTeamMember) {
    setBusy(member.id);
    const result = await deleteAdminAccountAction(member.id);
    setBusy("");
    if (!result.ok) {
      show(result.error, "danger");
      return;
    }
    show("Account deleted.");
    window.location.reload();
  }

  async function toggle(member: AdminTeamMember) {
    setBusy(member.id);
    const result = await setAdminDisabledAction(member.id, !member.disabledAt);
    setBusy("");
    if (!result.ok) {
      show(result.error, "danger");
      return;
    }
    show(member.disabledAt ? "Account re-enabled." : "Account disabled and signed out everywhere.");
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-border bg-paper p-4">
        <h2 className="font-display text-sm font-semibold text-ink">Current accounts</h2>
        <ul className="mt-3 divide-y divide-border">
          {team.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  <ShieldCheck className="size-3.5 text-primary" /> {member.name}
                  {member.disabledAt ? <span className="text-xs text-danger">· disabled</span> : null}
                </p>
                <p className="text-xs text-ink-muted">{member.email}</p>
                <p className="text-[11px] text-ink-faint">
                  {ROLE_LABEL[member.role]} ·{" "}
                  {member.lastLoginAt ? `last signed in ${formatShortDate(member.lastLoginAt)}` : "never signed in"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === member.id}
                  onClick={() => setResetting(resetting === member.id ? "" : member.id)}
                >
                  <KeyRound className="size-3.5" /> Reset password
                </Button>
                <Button size="sm" variant="outline" disabled={busy === member.id} onClick={() => void toggle(member)}>
                  {busy === member.id ? <Loader2 className="size-3.5 animate-spin" /> : member.disabledAt ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                  {member.disabledAt ? "Re-enable" : "Disable"}
                </Button>
                <Button size="sm" variant="ghost" disabled={busy === member.id} onClick={() => void remove(member)}>
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              </div>
              {resetting === member.id ? (
                <div className="mt-2 flex w-full flex-wrap items-end gap-2 rounded-xl border border-border bg-surface p-2.5">
                  <div className="min-w-40 flex-1">
                    <label className="text-[11px] font-medium text-ink-muted" htmlFor={`pw-${member.id}`}>
                      New password for {member.email}
                    </label>
                    <PasswordInput
                      id={`pw-${member.id}`}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <Button size="sm" disabled={busy === member.id || newPassword.length < 8} onClick={() => void resetPassword(member)}>
                    {busy === member.id ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />} Set password
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        {revealed ? (
          <p className="mt-3 rounded-xl bg-primary-soft px-3 py-2.5 text-xs text-ink">
            <strong className="font-semibold">Password changed for {revealed.email}.</strong> Give them{" "}
            <code className="rounded bg-paper px-1.5 py-0.5 font-mono">{revealed.password}</code> directly. They were
            signed out everywhere, and it is not emailed by design.
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-paper p-4">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink">
          <UserPlus className="size-4 text-primary" /> Add someone
        </h2>

        {created ? (
          <p className="mt-3 rounded-xl bg-primary-soft px-3 py-2.5 text-xs text-ink">
            <strong className="font-semibold">Account created for {created.email}.</strong> Give them the password you
            typed, in person or over a call. It is not emailed, by design — an emailed password sits in a mailbox
            forever. They can change it after signing in.
          </p>
        ) : null}

        <form onSubmit={create} className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Name" htmlFor="team-name">
            <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Email" htmlFor="team-email">
            <Input id="team-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password" htmlFor="team-password" hint="At least 8 characters. Share it directly, not by email.">
            <PasswordInput id="team-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Field label="Role" htmlFor="team-role" hint={ROLE_DESCRIPTION[role]}>
            <Select id="team-role" value={role} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRole(e.target.value as AdminRole)}>
              <option value="affiliate_manager">{ROLE_LABEL.affiliate_manager}</option>
              <option value="analyst">{ROLE_LABEL.analyst}</option>
              <option value="owner">{ROLE_LABEL.owner}</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              {pending ? "Creating…" : "Create account"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
