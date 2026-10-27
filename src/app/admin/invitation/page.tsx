import { acceptEditorialInvitationAction } from "@/lib/actions/editorial-invitation-actions";
import { ActionForm } from "@/components/distribution/action-form";
import { JktlMark } from "@/components/app/logo";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Join the JKTL Editorial Team",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main className="mx-auto max-w-lg px-6 py-20">
      <JktlMark className="size-12" />
      <h1 className="mt-6 text-3xl font-semibold">
        Your next chapter with JKTL.
      </h1>
      <p className="my-5 text-ink-muted">
        Accept your Editorial Team invitation by setting your own password. You
        will then sign in through the existing Team login.
      </p>
      <ActionForm action={acceptEditorialInvitationAction}>
        <input type="hidden" name="token" value={token || ""} />
        <label className="block">
          New password
          <input
            className="mt-2 block w-full rounded-xl border border-border bg-surface p-3"
            type="password"
            name="password"
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            required
          />
        </label>
        <button
          className="mt-5 rounded-xl bg-ink px-6 py-3 text-surface"
          type="submit"
        >
          Accept invitation
        </button>
      </ActionForm>
    </main>
  );
}
