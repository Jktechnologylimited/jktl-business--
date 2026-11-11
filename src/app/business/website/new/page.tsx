import { Sparkles } from "lucide-react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getBusinessProfile } from "@/lib/db/organizations";
import { getWebsiteTemplate } from "@/lib/website-templates";
import { CreateWebsite } from "@/components/websites/create-website";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const s = await getSession();
  if (!s) redirect("/login");
  const { template } = await searchParams;
  if (template && !getWebsiteTemplate(template)) notFound();
  const p = await getBusinessProfile(s.organizationId);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/business/website"
        className="text-sm text-blue-600 underline"
      >
        ← Your websites
      </Link>
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Create another website</h1>
          <p className="mt-3 text-sm leading-7 text-ink-muted">
            Choose a template or start with a custom blank design, then choose
            your own available address.
          </p>
        </div>
        <Link
          href="/business/plans"
          className="self-start rounded-full bg-[#c9a84c] px-6 py-3 font-semibold text-[#060e2a] shadow-md"
        >
          Upgrade <Sparkles size={18} aria-hidden="true" style={{display:"inline-block",verticalAlign:"middle"}} />
        </Link>
      </div>
      <CreateWebsite
        selected={template || "blank-website"}
        businessName={p?.displayName || "My website"}
      />
    </div>
  );
}
