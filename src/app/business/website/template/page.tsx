import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getBusinessProfile } from "@/lib/db/organizations";
import { getWebsiteTemplate } from "@/lib/website-templates";
import { TemplateEditor } from "@/components/templates/TemplateEditor";
export const dynamic = "force-dynamic";
export default async function TemplateEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const params = await searchParams;
  if (params.template && !getWebsiteTemplate(params.template)) notFound();
  const session = await getSession();
  const profile = session
    ? await getBusinessProfile(session.organizationId)
    : null;
  const selected =
    getWebsiteTemplate(params.template)?.id ||
    profile?.websiteTemplateId ||
    "law-firm";
  return (
    <TemplateEditor
      key={`${profile?.id || "demo"}-${selected}`}
      initialProfile={profile}
      selectedId={selected}
    />
  );
}
