import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { websiteTemplates, getWebsiteTemplate } from "@/lib/website-templates";
import { TemplatePreview } from "@/components/templates/TemplatePreview";
export const dynamicParams = false;
export function generateStaticParams() {
  return websiteTemplates.map((t) => ({ slug: t.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const template = getWebsiteTemplate((await params).slug);
  return {
    title: `${template?.name || "Website"} Template Preview`,
    robots: { index: false, follow: true },
  };
}
export default async function TemplatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!getWebsiteTemplate(slug)) notFound();
  return <TemplatePreview id={slug} />;
}
