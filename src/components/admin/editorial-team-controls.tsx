"use client";
import { useState } from "react";
import { inviteEditorialAction } from "@/lib/actions/editorial-invitation-actions";
import { configureEditorialMemberAction } from "@/lib/actions/editorial-actions";
import { ActionForm } from "@/components/distribution/action-form";
import { EDITORIAL_PERMISSIONS, can } from "@/lib/admin-permissions";
import type { AdminTeamMember } from "@/lib/db/admin-auth";
export function EditorialPermissions({ member }: { member: AdminTeamMember }) {
  return (
    <details className="w-full">
      <summary>Editorial permissions</summary>
      <ActionForm
        action={configureEditorialMemberAction}
        className="mt-3 space-y-3"
      >
        <input type="hidden" name="id" value={member.id} />
        <label>
          Role{" "}
          <select
            name="role"
            defaultValue={member.role}
            className="rounded border border-border bg-surface p-2"
          >
            <option value="writer">Writer</option>
            <option value="editor">Editor</option>
          </select>
        </label>
        {EDITORIAL_PERMISSIONS.map((p) => (
          <label key={p} className="flex gap-2">
            <input
              type="checkbox"
              name="permissions"
              value={p}
              defaultChecked={can(member.role, p, member.permissions)}
            />
            {p.replaceAll("_", " ")}
          </label>
        ))}
        <p className="text-xs text-ink-muted">
          Owner approval is always required for official releases and sensitive
          announcements. These permissions allow an Editor to publish that
          approved revision.
        </p>
        <button type="submit">Save editorial access</button>
      </ActionForm>
    </details>
  );
}
export function EditorialInvite() {
  const [result, setResult] = useState<{
    url: string;
    emailSent: boolean;
  } | null>(null);
  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold">Invite an editorial teammate</h2>
      <p className="my-3 text-sm text-ink-muted">
        Invite a Writer or Editor to set their own password. No customer or
        financial access is granted.
      </p>
      <ActionForm
        action={async (f) => {
          setResult(await inviteEditorialAction(f));
        }}
        className="grid gap-3"
      >
        <input
          name="name"
          placeholder="Full name"
          aria-label="Full name"
          required
          maxLength={100}
          className="rounded border border-border bg-surface p-3"
        />
        <input
          name="email"
          type="email"
          placeholder="Email address"
          aria-label="Email address"
          required
          className="rounded border border-border bg-surface p-3"
        />
        <select
          name="role"
          aria-label="Editorial role"
          className="rounded border border-border bg-surface p-3"
        >
          <option value="writer">Writer</option>
          <option value="editor">Editor</option>
        </select>
        <button type="submit">Send invitation</button>
      </ActionForm>
      {result && (
        <div className="mt-4 break-all text-sm">
          <p>
            {result.emailSent
              ? "Invitation emailed."
              : "Email could not be sent. Share this private link directly with the invited person."}
          </p>
          <a href={result.url}>{result.url}</a>
          <p>This one-time link expires in 7 days.</p>
        </div>
      )}
    </section>
  );
}
