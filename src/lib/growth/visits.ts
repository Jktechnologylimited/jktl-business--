import "server-only";
import { cookies, headers } from "next/headers";
import { query } from "@/lib/custom/service";
export const VISIT_COOKIE = "jktl_growth_visit";
export const validVisit = (v: string) =>
  /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
export function publicGrowthPath(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > 200 ||
    !/^\/(?:[a-z0-9/-]*)$/i.test(value)
  )
    return null;
  return /^\/(?:$|templates(?:\/|$)|products(?:\/|$)|solutions(?:\/|$)|case-studies(?:\/|$)|blog(?:\/|$)|pricing$|partners$|affiliates$|how-it-works$)/.test(
    value,
  )
    ? value
    : null;
}
export async function consumeGrowthVisit(organizationId: string) {
  const jar = await cookies();
  if (jar.get("jktl_journey_analytics")?.value !== "yes") return;
  const h = await headers();
  if (h.get("sec-gpc") === "1" || h.get("dnt") === "1") return;
  const id = jar.get(VISIT_COOKIE)?.value;
  if (!id || !validVisit(id)) return;
  await query(
    `UPDATE growth_visits SET organization_id=$2,registered_at=now() WHERE id=$1 AND organization_id IS NULL AND expires_at>now() AND EXISTS(SELECT 1 FROM organizations WHERE id=$2 AND created_at>now()-interval '1 hour') AND NOT EXISTS(SELECT 1 FROM growth_visits WHERE organization_id=$2)`,
    [id, organizationId],
  );
}
