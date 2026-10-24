import type { WebsiteDocument } from "./website-templates";
export type TemplateQuery = (
  text: string,
  params: unknown[],
) => Promise<Record<string, unknown>[]>;
export async function saveTemplateDocument(
  query: TemplateQuery,
  input: {
    organizationId: string;
    templateId: string;
    document: WebsiteDocument;
    revision: number;
    published: boolean;
  },
) {
  const rows = await query(
    `UPDATE business_profiles SET website_template_id=$1,website_document=$2::jsonb,website_revision=website_revision+1,theme_color=$3,published=$4 WHERE organization_id=$5 AND website_revision=$6 RETURNING *`,
    [
      input.templateId,
      JSON.stringify(input.document),
      input.document.accent,
      input.published,
      input.organizationId,
      input.revision,
    ],
  );
  if (!rows[0])
    throw new Error(
      "The website changed in another session. Reload before saving again.",
    );
  return rows[0];
}
