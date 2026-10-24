import { notFound } from "next/navigation";
import { websiteTemplates, getWebsiteTemplate } from "@/lib/website-templates";
import { RawTemplatePreview } from "@/components/templates/TemplatePreview";
export const dynamicParams = false;
export function generateStaticParams() {
  return websiteTemplates.map((t) => ({ slug: t.id }));
}
export const metadata = { robots: { index: false, follow: false } };
export default async function Canvas({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!getWebsiteTemplate(slug)) notFound();
  return <RawTemplatePreview id={slug} />;
}
