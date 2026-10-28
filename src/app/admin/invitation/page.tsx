import { limitInvitationRequest } from "@/lib/mail/invitation-rate";
import Link from "next/link";
import { acceptTeamUserInvitationAction } from "@/lib/actions/team-invitation-actions";
import { inspectTeamInvitation } from "@/lib/mail/invitations";
import { query } from "@/lib/custom/service";
import { ActionForm } from "@/components/distribution/action-form";
import { JktlMark } from "@/components/app/logo";
import { ROLE_LABEL, type AdminRole } from "@/lib/admin-permissions";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Join the JKTL Team",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (token && /^[a-f0-9]{64}$/.test(token))
    await limitInvitationRequest("view");
  const invitation = await inspectTeamInvitation(query, token || "");
  if (!invitation)
    return (
      <main className="mx-auto max-w-lg p-10">
        <h1>Invitation unavailable</h1>
        <p>
          This link expired, was revoked or has already been accepted. Ask the
          JKTL team for a new invitation.
        </p>
      </main>
    );
  const newAccount =
    invitation.accept_mode === "NEW_TEAM" && !invitation.business_exists;
  return (
    <main className="mx-auto max-w-lg space-y-5 px-6 py-16">
      <JktlMark className="size-12" />
      <h1 className="text-3xl font-semibold">Your next chapter with JKTL.</h1>
      <p>
        Hello {String(invitation.name || "there")}. Your invited role is{" "}
        {ROLE_LABEL[invitation.role as AdminRole] || "Team"}.
      </p>
      <p>{String(invitation.message)}</p>
      <p>
        Expires{" "}
        {new Date(String(invitation.expires_at)).toLocaleString("en-NG", {
          timeZone: "Africa/Lagos",
        })}{" "}
        (Lagos).
      </p>
      {!newAccount && (
        <p>
          Sign in to your{" "}
          {invitation.accept_mode === "TEAM"
            ? "existing Team"
            : "existing Business"}{" "}
          account, then reopen this invitation to accept. Your password will
          stay unchanged.{" "}
          <Link
            className="underline"
            href={
              invitation.accept_mode === "TEAM"
                ? "/admin/login"
                : "/login?next=team-invite&invite=" + token
            }
          >
            Sign in
          </Link>
        </p>
      )}
      <ActionForm
        action={acceptTeamUserInvitationAction}
        className="grid gap-4"
      >
        <input type="hidden" name="token" value={token} />
        {newAccount && (
          <label>
            Choose your own password
            <input
              type="password"
              name="password"
              minLength={12}
              maxLength={72}
              autoComplete="new-password"
              required
              className="mt-2 block w-full rounded-xl border border-border bg-surface p-3"
            />
            <small>At least 12 characters; at most 72 UTF-8 bytes.</small>
          </label>
        )}
        <label className="flex gap-3">
          <input type="checkbox" name="consent" required /> I accept this team
          role and the applicable JKTL terms and responsibilities.
        </label>
        <button className="rounded-xl bg-ink px-6 py-3 text-surface">
          Accept invitation
        </button>
      </ActionForm>
    </main>
  );
}
