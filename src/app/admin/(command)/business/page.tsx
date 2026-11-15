import { requireAdminSession } from "@/lib/admin-session";
import { ActionForm } from "@/components/distribution/action-form";
import { PasswordInput } from "@/components/ui/password-input";
import {
  openTeamBusinessAction,
  connectTeamBusinessAction,
} from "@/lib/actions/team-business-actions";

export default async function Page() {
  const team = await requireAdminSession();
  return (
    <section className="mx-auto max-w-xl space-y-5 rounded-xl border border-border bg-paper p-6">
      <h1 className="text-2xl font-semibold">Your JKTL Business access</h1>
      <p>
        Your Team account includes access to your own Business workspace. You do
        not need to sign up again. Team tools and customer access continue to
        follow your assigned permissions.
      </p>
      <ActionForm action={openTeamBusinessAction}>
        <button className="rounded-lg bg-primary px-5 py-3 text-on-primary">
          Open JKTL Business
        </button>
      </ActionForm>
      {!team.businessUserId && (
        <details className="space-y-4">
          <summary className="cursor-pointer font-semibold">
            Already have a separate Business account with this email?
          </summary>
          <p className="mt-4">
            Confirm its existing password once to connect {team.email}. This
            protects your existing workspace and keeps your Business password
            unchanged. After connecting, use that password for both Team and
            Business.
          </p>
          <ActionForm
            action={connectTeamBusinessAction}
            className="mt-4 space-y-4"
          >
            <label className="block">
              Existing Business password
              <PasswordInput
                name="password"
                required
                autoComplete="current-password"
              />
            </label>
            <button className="rounded-lg border border-border px-5 py-3">
              Connect my existing account
            </button>
          </ActionForm>
        </details>
      )}
    </section>
  );
}
