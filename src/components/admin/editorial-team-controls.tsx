"use client";
import Link from "next/link";
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
  return (
    <Link
      href="/admin/emails/invite"
      className="rounded-lg border border-border p-3"
    >
      Invite a teammate through Emails → Invite User
    </Link>
  );
}
