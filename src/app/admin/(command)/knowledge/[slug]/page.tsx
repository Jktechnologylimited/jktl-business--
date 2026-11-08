import { notFound } from "next/navigation";
import { guardAdminPage } from "@/lib/admin-page-guard";
import { KnowledgeArticle } from "@/components/knowledge/knowledge-pages";
import { PUBLIC_ARTICLES } from "@/lib/knowledge/catalog";
import { TEAM_GUIDES } from "@/lib/knowledge/team";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Team platform guide | JKTL",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await guardAdminPage("view_knowledge");
  const { slug } = await params,
    articles = [...PUBLIC_ARTICLES, ...TEAM_GUIDES],
    g = articles.find((g) => g.id === slug);
  if (!g) notFound();
  return (
    <KnowledgeArticle
      guide={g}
      articles={articles}
      base="/admin/knowledge"
      team
    />
  );
}
