"use client";

import { ActionForm } from "@/components/distribution/action-form";
import { configureGrowthStaffAction } from "@/lib/actions/growth-staff-actions";
import { can, GROWTH_PERMISSIONS } from "@/lib/admin-permissions";
import {
  EditorialPermissions,
  EditorialInvite,
} from "./editorial-team-controls";
import { useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { formatShortDate } from "@/lib/format";
import { useToastStore } from "@/lib/toast";
import { ROLE_LABEL } from "@/lib/admin-permissions";
import {
  deleteAdminAccountAction,
  resetAdminPasswordAction,
  setAdminDisabledAction,
} from "@/lib/actions/admin-actions";
import type { AdminTeamMember } from "@/lib/db/admin-auth";

/** Manage existing access. New accounts use Emails → Invite User so recipients
 * choose their own passwords and existing Business identities remain linked. */
export function TeamManager({ team }: { team: AdminTeamMember[] }) {
  const show = useToastStore((s) => s.show);
  const [busy, setBusy] = useState("");
  /** Which account is having its password reset, and the new value — shown once. */
  const [resetting, setResetting] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [revealed, setRevealed] = useState<{
    email: string;
    password: string;
  } | null>(null);

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
    if (member.role === "growth_gaming_lead") {
      const form = new FormData();
      form.set("id", member.id);
      form.set("mode", "REVOKE");
      try {
        await configureGrowthStaffAction(form);
        window.location.reload();
      } catch {
        show("Could not revoke access.", "danger");
      }
      setBusy("");
      return;
    }
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
    if (member.role === "growth_gaming_lead") {
      const f = new FormData();
      f.set("id", member.id);
      f.set(
        "mode",
        member.revokedAt ? "RESTORE" : member.disabledAt ? "ENABLE" : "SUSPEND",
      );
      try {
        await configureGrowthStaffAction(f);
        window.location.reload();
      } catch {
        show("Could not change team access.", "danger");
      }
      setBusy("");
      return;
    }
    const result = await setAdminDisabledAction(member.id, !member.disabledAt);
    setBusy("");
    if (!result.ok) {
      show(result.error, "danger");
      return;
    }
    show(
      member.disabledAt
        ? "Account re-enabled."
        : "Account disabled and signed out everywhere.",
    );
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <EditorialInvite />
      <section className="rounded-2xl border border-border bg-paper p-4">
        <h2 className="font-display text-sm font-semibold text-ink">
          Current accounts
        </h2>
        <ul className="mt-3 divide-y divide-border">
          {team.map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  <ShieldCheck className="size-3.5 text-primary" />{" "}
                  {member.name}
                  {member.disabledAt ? (
                    <span className="text-xs text-danger">· disabled</span>
                  ) : null}
                </p>
                <p className="text-xs text-ink-muted">{member.email}</p>
                <p className="text-[11px] text-ink-faint">
                  {ROLE_LABEL[member.role]} ·{" "}
                  {member.lastLoginAt
                    ? `last signed in ${formatShortDate(member.lastLoginAt)}`
                    : "never signed in"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    busy === member.id || Boolean(member.businessUserId)
                  }
                  onClick={() =>
                    setResetting(resetting === member.id ? "" : member.id)
                  }
                >
                  <KeyRound className="size-3.5" /> Reset password
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === member.id}
                  onClick={() => void toggle(member)}
                >
                  {busy === member.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : member.disabledAt ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <XCircle className="size-3.5" />
                  )}
                  {member.revokedAt
                    ? "Restore role"
                    : member.disabledAt
                      ? "Re-enable"
                      : "Disable"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === member.id}
                  onClick={() => void remove(member)}
                >
                  <Trash2 className="size-3.5" />{" "}
                  {member.role === "growth_gaming_lead"
                    ? "Revoke access"
                    : "Delete"}
                </Button>
              </div>
              {["writer", "editor"].includes(member.role) && (
                <EditorialPermissions member={member} />
              )}
              {member.role === "growth_gaming_lead" && (
                <details className="w-full">
                  <summary className="cursor-pointer text-sm font-semibold text-ink">
                    Permissions
                  </summary>
                  <ActionForm
                    action={configureGrowthStaffAction}
                    className="mt-3 space-y-3"
                  >
                    <input type="hidden" name="id" value={member.id} />
                    <input type="hidden" name="mode" value="PERMISSIONS" />
                    <div className="grid gap-3 sm:grid-cols-2">
                      {GROWTH_PERMISSIONS.map((p) => (
                        <label className="flex gap-2 text-sm" key={p}>
                          <input
                            type="checkbox"
                            name="permissions"
                            value={p}
                            defaultChecked={can(
                              member.role,
                              p,
                              member.permissions,
                            )}
                          />
                          {p.replace("growth_", "").replaceAll("_", " ")}
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-ink-muted">
                      Banking, payouts, pricing and team administration remain
                      restricted.
                    </p>
                    <Button type="submit" size="sm">
                      Save permissions
                    </Button>
                  </ActionForm>
                </details>
              )}
              {member.businessUserId && (
                <p className="w-full text-xs text-ink-muted">
                  Uses their existing Business password.
                </p>
              )}
              {resetting === member.id ? (
                <div className="mt-2 flex w-full flex-wrap items-end gap-2 rounded-xl border border-border bg-surface p-2.5">
                  <div className="min-w-40 flex-1">
                    <label
                      className="text-[11px] font-medium text-ink-muted"
                      htmlFor={`pw-${member.id}`}
                    >
                      New password for {member.email}
                    </label>
                    <PasswordInput
                      id={`pw-${member.id}`}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={busy === member.id || newPassword.length < 8}
                    onClick={() => void resetPassword(member)}
                  >
                    {busy === member.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="size-3.5" />
                    )}{" "}
                    Set password
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        {revealed ? (
          <p className="mt-3 rounded-xl bg-primary-soft px-3 py-2.5 text-xs text-ink">
            <strong className="font-semibold">
              Password changed for {revealed.email}.
            </strong>{" "}
            Give them{" "}
            <code className="rounded bg-paper px-1.5 py-0.5 font-mono">
              {revealed.password}
            </code>{" "}
            directly. They were signed out everywhere, and it is not emailed by
            design.
          </p>
        ) : null}
      </section>
    </div>
  );
}
