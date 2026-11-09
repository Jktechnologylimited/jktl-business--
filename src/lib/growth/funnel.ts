import "server-only";
import { query } from "@/lib/custom/service";
export async function recordConsentedFunnel(
  visit: string,
  path: string | null,
  event?: unknown,
  utm?: unknown,
) {
  if (
    !(
      await query("SELECT to_regclass('public.growth_funnel_events') present")
    )[0]?.present
  )
    return;
  const intent = ["registration_started", "template_selected"].includes(
    String(event),
  )
    ? String(event)
    : null;
  const stage =
    intent ||
    (path === "/templates"
      ? "gallery_visit"
      : /^\/templates\/[^/]+$/.test(path || "")
        ? "template_preview"
        : null);
  if (stage)
    await query(
      "INSERT INTO growth_funnel_events(event_key,visit_id,stage,origin) VALUES($1,$2,$3,'CONSENTED') ON CONFLICT DO NOTHING",
      ["browser:" + visit + ":" + stage, visit, stage],
    );
  const u =
    utm && typeof utm === "object" ? (utm as Record<string, unknown>) : {};
  const values = ["source", "medium", "campaign"].map((k) =>
    typeof u[k] === "string" && /^[a-zA-Z0-9_. -]{1,80}$/.test(String(u[k]))
      ? String(u[k])
      : "",
  );
  if (values.every(Boolean))
    await query(
      `UPDATE growth_visits SET campaign_id=c.id FROM growth_campaigns c WHERE growth_visits.id=$1 AND growth_visits.campaign_id IS NULL AND c.enabled AND c.utm_source=$2 AND c.utm_medium=$3 AND c.utm_campaign=$4`,
      [visit, ...values],
    );
}
