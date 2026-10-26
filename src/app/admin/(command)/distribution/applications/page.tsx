import { ActionForm } from "@/components/distribution/action-form";
import Link from "next/link";
import { guardAdminPage } from "@/lib/admin-page-guard";
import { query } from "@/lib/custom/service";
import { manageProgramApplicationAction } from "@/lib/actions/distribution-program-actions";
export const dynamic = "force-dynamic";
export default async function Page() {
  await guardAdminPage("manage_affiliates");
  const rows = await query(
    "SELECT id,name,programme,status,application_stage,application_data,application_note,applicant_message FROM affiliates ORDER BY created_at DESC LIMIT 100",
  );
  const growthReviews = await query(
    "SELECT affiliate_id,recommendation,note,created_at FROM growth_application_reviews ORDER BY created_at DESC LIMIT 200",
  );
  return (
    <div className="space-y-5 text-ink">
      <h1 className="text-3xl font-semibold">Program applications</h1>
      <p>
        Approve through the existing{" "}
        <Link className="underline" href="/admin/affiliates">
          Affiliate
        </Link>{" "}
        or{" "}
        <Link className="underline" href="/admin/partners">
          Partner
        </Link>{" "}
        controls. Partners require their written agreement before access.
        Rejections retain their audit and policy records.
      </p>
      {rows.map((r) => (
        <article
          key={String(r.id)}
          className="space-y-3 rounded-xl border border-border p-5"
        >
          <strong>
            {String(r.name)} · {String(r.programme)} ·{" "}
            {String(r.application_stage)}
          </strong>
          <p className="whitespace-pre-wrap">{String(r.application_note)}</p>
          <pre className="whitespace-pre-wrap break-words text-xs">
            {JSON.stringify(r.application_data, null, 2)}
          </pre>
          {growthReviews
            .filter((g) => g.affiliate_id === r.id)
            .map((g, i) => (
              <p key={i} className="rounded border border-border p-3 text-sm">
                Growth recommendation: {String(g.recommendation)} ·{" "}
                {String(g.created_at)} · {String(g.note)}
              </p>
            ))}
          <ActionForm
            action={manageProgramApplicationAction}
            className="grid gap-3"
          >
            <input type="hidden" name="id" value={String(r.id)} />
            <label>
              Review stage
              <select
                name="stage"
                className="ml-2 rounded border border-border bg-paper p-2"
              >
                {["UNDER_REVIEW", "REJECTED", "SUSPENDED", "TERMINATED"].map(
                  (v) => (
                    <option key={v}>{v}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              Review note
              <input
                name="note"
                required
                minLength={10}
                maxLength={2000}
                className="block w-full rounded border border-border bg-paper p-3"
              />
            </label>
            <label>
              Message to applicant (will be emailed and shown in Business)
              <textarea
                name="applicantMessage"
                maxLength={2000}
                defaultValue={String(r.applicant_message || "")}
                className="block w-full rounded border border-border bg-paper p-3"
              />
            </label>
            <button className="rounded border border-border p-3">
              Record review
            </button>
          </ActionForm>
        </article>
      ))}
    </div>
  );
}
