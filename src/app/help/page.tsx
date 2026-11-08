import type { Metadata } from "next";
import { KnowledgeIndex } from "@/components/knowledge/knowledge-pages";
import { PUBLIC_ARTICLES, searchQuery } from "@/lib/knowledge/catalog";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { q, topic } = searchQuery(await searchParams);
  return {
    title: "JKTL Knowledge Base | Help Centre",
    description:
      "Step-by-step JKTL guides for websites, domains, business email, payments, partners, affiliates, custom projects and support.",
    alternates: { canonical: "https://business.jktl.com.ng/help" },
    robots:
      q || topic !== "all"
        ? { index: false, follow: true }
        : { index: true, follow: true },
  };
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = searchQuery(await searchParams);
  return <KnowledgeIndex articles={PUBLIC_ARTICLES} {...filters} />;
}
