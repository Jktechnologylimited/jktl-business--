import { guardAdminPage } from "@/lib/admin-page-guard";
import { KnowledgeIndex } from "@/components/knowledge/knowledge-pages";
import { PUBLIC_ARTICLES, searchQuery } from "@/lib/knowledge/catalog";
import { TEAM_GUIDES } from "@/lib/knowledge/team";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Team knowledge base | JKTL",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await guardAdminPage("view_knowledge");
  return (
    <KnowledgeIndex
      articles={[...PUBLIC_ARTICLES, ...TEAM_GUIDES]}
      {...searchQuery(await searchParams)}
      base="/admin/knowledge"
      team
    />
  );
}
