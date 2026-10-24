export const SITE_EVENT_TYPES = ["view", "cta", "contact"] as const;
export function parseSiteEvent(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Invalid event.");
  const b = raw as Record<string, unknown>;
  if (
    typeof b.subdomain !== "string" ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(b.subdomain) ||
    typeof b.templateId !== "string" ||
    !/^[a-z0-9-]{1,100}$/.test(b.templateId) ||
    typeof b.eventId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      b.eventId,
    ) ||
    !SITE_EVENT_TYPES.includes(b.event as (typeof SITE_EVENT_TYPES)[number])
  )
    throw new Error("Invalid event.");
  return {
    subdomain: b.subdomain,
    templateId: b.templateId,
    eventId: b.eventId,
    event: b.event as (typeof SITE_EVENT_TYPES)[number],
  };
}
export type MetricsQuery = (
  text: string,
  params: unknown[],
) => Promise<Record<string, unknown>[]>;
export async function recordSiteEvent(
  query: MetricsQuery,
  event: {
    organizationId: string;
    templateId: string;
    eventId: string;
    event: string;
    kind: string;
  },
) {
  return query(
    `INSERT INTO website_metric_events(organization_id,event_id,template_id,page_kind,event_type) VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,event_id) DO NOTHING RETURNING event_id`,
    [
      event.organizationId,
      event.eventId,
      event.templateId,
      event.kind,
      event.event,
    ],
  );
}
export async function siteMetrics(query: MetricsQuery, organizationId: string) {
  return query(
    `SELECT template_id,page_kind,COUNT(*) FILTER(WHERE event_type='view')::integer AS views,COUNT(*) FILTER(WHERE event_type='cta')::integer AS cta_clicks,COUNT(*) FILTER(WHERE event_type='contact')::integer AS contact_clicks,COUNT(*) FILTER(WHERE event_type='booking')::integer AS bookings FROM website_metric_events WHERE organization_id=$1 AND created_at>=now()-interval '30 days' GROUP BY template_id,page_kind ORDER BY views DESC`,
    [organizationId],
  );
}
