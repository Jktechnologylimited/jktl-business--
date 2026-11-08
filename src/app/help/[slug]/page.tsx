import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KnowledgeArticle } from "@/components/knowledge/knowledge-pages";
import { PUBLIC_ARTICLES } from "@/lib/knowledge/catalog";
export const dynamicParams = false;
export function generateStaticParams() {
  return PUBLIC_ARTICLES.map((g) => ({ slug: g.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = PUBLIC_ARTICLES.find((a) => a.id === slug);
  return article
    ? {
        title: `${article.title} | JKTL Help`,
        description: article.summary,
        alternates: {
          canonical: `https://business.jktl.com.ng/help/${article.id}`,
        },
        robots: { index: true, follow: true },
      }
    : { robots: { index: false, follow: false } };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const g = PUBLIC_ARTICLES.find((g) => g.id === slug);
  if (!g) notFound();
  return <KnowledgeArticle guide={g} articles={PUBLIC_ARTICLES} />;
}
