import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getWebsiteTemplate,
  websitePagePaths,
  websitePageMeta,
} from "@/lib/website-templates";
import { RawTemplatePreview } from "@/components/templates/TemplatePreview";
// Cache subpages on first access; do not prebuild thousands of preview URLs.
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; path: string[] }>;
}): Promise<Metadata> {
  const p = await params,
    t = getWebsiteTemplate(p.slug);
  if (!t || !websitePagePaths(t, t.document).includes(p.path.join("/")))
    notFound();
  const meta = websitePageMeta(t, t.document, p.path.join("/"));
  return {
    title: meta?.title,
    description: meta?.description,
    robots: { index: false, follow: false },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; path: string[] }>;
}) {
  const p = await params,
    t = getWebsiteTemplate(p.slug),
    path = p.path.join("/");
  if (!t || !websitePagePaths(t, t.document).includes(path)) notFound();
  return <RawTemplatePreview id={p.slug} pagePath={path} />;
}
