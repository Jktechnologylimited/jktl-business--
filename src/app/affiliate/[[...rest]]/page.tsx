import { redirect } from "next/navigation";

/**
 * The singular spelling.
 *
 * `jktl.com.ng/affiliate` is what the marketing site links to, what the partner
 * programme is called in conversation, and what a partner will type from memory.
 * The dashboard's own routes are plural (`/affiliates`), so rather than maintain
 * two sets of pages, the singular form lands on the plural one — including any
 * subpath, so `/affiliate/login` reaches the sign-in page and
 * `/affiliate/apply` reaches the application form.
 *
 * A 404 here was the whole bug: the marketing redirect pointed at `/affiliate`,
 * which did not exist.
 */
export default async function AffiliateAliasPage({ params }: { params: Promise<{ rest?: string[] }> }) {
  const { rest } = await params;
  redirect(rest && rest.length > 0 ? `/affiliates/${rest.join("/")}` : "/affiliates");
}
