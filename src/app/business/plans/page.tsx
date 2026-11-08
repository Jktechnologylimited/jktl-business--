import { WebsitePlanBilling } from "@/components/settings/website-plan-billing";
import { getSession } from "@/lib/session";
import { loadWebsite } from "@/lib/websites/service";
export default async function Plans({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const { site } = await searchParams;
  const s = await getSession();
  const row =
    s && site && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(site)
      ? await loadWebsite(site)
      : null;
  return (
    <WebsitePlanBilling
      siteId={row ? String(row.id) : undefined}
      siteTemplate={row ? String(row.template_id) : undefined}
    />
  );
}
