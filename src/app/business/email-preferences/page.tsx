import { requireSession } from "@/lib/session";
import { query } from "@/lib/custom/service";
import { saveMyMailPreferencesAction } from "@/lib/actions/mail-preferences-actions";
import { ActionForm } from "@/components/distribution/action-form";
export const dynamic = "force-dynamic";
export default async function Page() {
  const s = await requireSession();
  const p = (
    await query(
      "SELECT p.marketing_opt_in,p.marketing_suppressed FROM users u LEFT JOIN email_preferences p ON p.email=lower(u.email) WHERE u.id=$1",
      [s.userId],
    )
  )[0];
  return (
    <div className="space-y-5 p-5 text-ink">
      <h1 className="text-2xl font-semibold">Email preferences</h1>
      <p>
        Essential account, security, payment and service messages remain
        available. Product promotions are optional and off unless you choose
        them.
      </p>
      <ActionForm action={saveMyMailPreferencesAction} className="space-y-4">
        <label className="flex gap-3">
          <input
            type="checkbox"
            name="marketing"
            defaultChecked={Boolean(
              p?.marketing_opt_in && !p?.marketing_suppressed,
            )}
          />
          I want JKTL product news and relevant optional promotions by email.
        </label>
        <button className="rounded-lg bg-primary p-3 text-on-primary">
          Save email preferences
        </button>
      </ActionForm>
    </div>
  );
}
