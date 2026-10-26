import { ActionForm } from "@/components/distribution/action-form";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { applyBusinessProgramAction } from "@/lib/actions/distribution-program-actions";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ program?: string }>;
}) {
  const { program } = await searchParams;
  if (!(await getSession()))
    redirect(
      "/login?next=programs&program=" +
        (program === "partner" ? "partner" : "affiliate"),
    );
  return (
    <div className="space-y-6 text-ink">
      <h1 className="text-3xl font-semibold">Apply with your JKTL account</h1>
      <p>
        Your Business name and email identify the applicant. No separate
        password is created. Applications require team member approval before
        referral eligibility or Partner access.
      </p>
      <ActionForm
        action={applyBusinessProgramAction}
        success="Application submitted. Track approval under Programs & partner access; you can open the program after approval."
        className="grid gap-4 md:grid-cols-2"
      >
        <label>
          Program
          <select
            required
            name="program"
            defaultValue={program === "partner" ? "partner" : "affiliate"}
            className="block w-full rounded border border-border bg-paper p-3"
          >
            <option value="affiliate">
              JKTL Affiliates — introduce businesses
            </option>
            <option value="partner">
              JKTL Partners — onboard and support clients
            </option>
          </select>
        </label>
        {[
          ["phone", "Phone"],
          ["country", "Country"],
          ["platform", "Main promotional platform (Affiliates)"],
          ["url", "Website or social profile URL"],
          ["audience", "Audience size (optional)"],
          ["promotion", "How you will promote JKTL (Affiliates)"],
          ["company", "Business or professional name (Partners)"],
          ["category", "Business category (Partners)"],
          ["services", "Services you provide (Partners)"],
          ["clients", "Approximate existing clients (Partners)"],
          ["products", "Intended JKTL products (Partners)"],
          ["monthlyReferrals", "Expected monthly referrals (Partners)"],
          ["partnership", "Describe your intended partnership (Partners)"],
          [
            "verification",
            "Business verification details (optional; no identity documents or secrets)",
          ],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <textarea
              name={key}
              required={["phone", "country"].includes(key)}
              maxLength={2000}
              className="mt-1 block w-full rounded border border-border bg-paper p-3"
            />
          </label>
        ))}
        <label className="flex gap-3 md:col-span-2">
          <input type="checkbox" required name="consent" />
          <span>
            I accept the applicable current{" "}
            <Link className="underline" href="https://jktl.com.ng/affiliates">
              Affiliate
            </Link>{" "}
            or{" "}
            <Link className="underline" href="https://jktl.com.ng/partners">
              Partner
            </Link>{" "}
            program terms. Proposed new commission policies are not
            automatically active. Partner-specific commercial terms require
            separate approval and acceptance.
          </span>
        </label>
        <button className="rounded-lg bg-primary p-3 text-on-primary">
          Submit for review
        </button>
      </ActionForm>
    </div>
  );
}
