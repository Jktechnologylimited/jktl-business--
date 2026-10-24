import { T } from "@/components/i18n/LanguageProvider";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { getSql } from "@/lib/db/client";
import { siteMetrics } from "@/lib/site-metrics";
import { getWebsiteTemplate } from "@/lib/website-templates";
export const dynamic = "force-dynamic";
export default async function WebsiteMetricsPage() {
  const session = await getSession();
  if (!session)
    return (
      <section className="space-y-4">
        <h1 className="font-display text-2xl">
          <T>Website & landing-page metrics</T>
        </h1>
        <p>
          <T>
            Metrics are available for published websites on a real account. Demo
            previews never generate traffic metrics.
          </T>
        </p>
        <Link href="/business/website" className="text-primary underline">
          <T>Back to websites</T>
        </Link>
      </section>
    );
  let rows: Record<string, unknown>[] = [];
  let unavailable = false;
  try {
    rows = await siteMetrics(
      (text, params) => getSql().query(text, params),
      session.organizationId,
    );
  } catch {
    unavailable = true;
  }
  const total = (key: string) =>
    rows.reduce((n, r) => n + Number(r[key] || 0), 0);
  return (
    <section className="space-y-6">
      <Link href="/business/website" className="text-sm text-primary underline">
        <T>← Website settings</T>
      </Link>
      <h1 className="font-display text-3xl">
        <T>Website & landing-page metrics</T>
      </h1>
      <p className="text-sm text-ink-muted">
        <T>
          Last 30 days. Events are attributed to the template published at the
          time. Views are page loads, not unique people. Previews and demo
          activity are excluded.
        </T>
      </p>
      {unavailable ? (
        <p role="alert">
          <T>
            Metrics are being prepared. Please try again after deployment
            completes.
          </T>
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ["views", "Page views"],
              ["cta_clicks", "CTA clicks"],
              ["contact_clicks", "Contact clicks"],
              ["bookings", "Confirmed booking requests"],
            ].map(([key, label]) => (
              <div
                key={key}
                className="rounded-xl border border-border bg-surface p-5"
              >
                <p className="text-xs text-ink-muted">{label}</p>
                <p className="mt-2 text-3xl font-semibold">{total(key)}</p>
              </div>
            ))}
          </div>
          {!rows.length ? (
            <p>
              <T>
                No measured traffic yet. Publish a template and share its
                website address to start collecting events.
              </T>
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {[
                      "Template",
                      "Type",
                      "Views",
                      "CTA clicks",
                      "Contact clicks",
                      "Bookings",
                      "Bookings / views",
                    ].map((h) => (
                      <th key={h} className="border-b border-border p-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={String(row.template_id)}>
                      <td className="p-3">
                        {getWebsiteTemplate(String(row.template_id))?.name ||
                          String(row.template_id)}
                      </td>
                      <td className="p-3">{String(row.page_kind)}</td>
                      {[
                        "views",
                        "cta_clicks",
                        "contact_clicks",
                        "bookings",
                      ].map((k) => (
                        <td key={k} className="p-3">
                          {Number(row[k])}
                        </td>
                      ))}
                      <td className="p-3">
                        {Number(row.views) > 0
                          ? `${((Number(row.bookings) / Number(row.views)) * 100).toFixed(1)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <p className="text-xs text-ink-muted">
        <T>
          No visitor names, emails, cookies or persistent visitor IDs are
          collected. Ad blockers, bots and blocked requests affect measurements.
          A booking is counted only after the existing booking flow saves it
          successfully.
        </T>
      </p>
    </section>
  );
}
