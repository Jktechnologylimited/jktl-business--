import { unsubscribeMailAction } from "@/lib/actions/mail-preferences-actions";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; done?: string }>;
}) {
  const p = await searchParams;
  return (
    <main className="mx-auto max-w-lg space-y-5 p-8 text-ink">
      <h1 className="text-2xl font-semibold">JKTL email preferences</h1>
      {p.done ? (
        <p>
          Your marketing preference has been updated. Essential service and
          security emails are unaffected.
        </p>
      ) : p.token && /^[0-9a-f-]{36}$/i.test(p.token) ? (
        <form action={unsubscribeMailAction} className="space-y-4">
          <input type="hidden" name="token" value={p.token} />
          <p>
            Confirm to stop optional JKTL marketing and product promotions.
            Opening this link alone does not change your preferences.
          </p>
          <button className="rounded-lg bg-primary p-3 text-on-primary">
            Stop marketing emails
          </button>
        </form>
      ) : (
        <p>
          Use the preference link in your email, or manage preferences in JKTL
          Business settings.
        </p>
      )}
    </main>
  );
}
