import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  websiteTemplates,
  getWebsiteTemplate,
  beautyPagePaths,
  beautyPageMeta,
} from "@/lib/website-templates";
import { RawTemplatePreview } from "@/components/templates/TemplatePreview";
export const dynamicParams = false;
export function generateStaticParams() {
  return websiteTemplates.flatMap((t) =>
    beautyPagePaths(t.document)
      .filter(Boolean)
      .map((path) => ({ slug: t.id, path: path.split("/") })),
  );
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; path: string[] }>;
}): Promise<Metadata> {
  const p = await params,
    t = getWebsiteTemplate(p.slug);
  const meta = t ? beautyPageMeta(t.document, p.path.join("/")) : undefined;
  return {
    title: meta?.title,
    description: meta?.description,
    robots: { index: false, follow: false },
  };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; path: string[] }>;
  searchParams: Promise<{ service?: string }>;
}) {
  const p = await params,
    t = getWebsiteTemplate(p.slug),
    path = p.path.join("/");
  if (!t?.document.beauty || !beautyPagePaths(t.document).includes(path))
    notFound();
  return (
    <RawTemplatePreview
      id={p.slug}
      pagePath={path}
      initialService={(await searchParams).service}
    />
  );
}
