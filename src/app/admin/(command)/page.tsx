import Link from "next/link";
import { guardAdminPage } from "@/lib/admin-page-guard";
import { PageHeader } from "@/components/app/page-header";
import { StatTile } from "@/components/app/stat-tile";
import { AdminBusinessTable } from "@/components/admin/business-table";
import { IntegrationHealth } from "@/components/admin/integration-health";
import { listBusinessesForAdmin, summarize } from "@/lib/db/admin";
import { formatKobo, formatGb } from "@/lib/format";
import { ArrowUpRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  // Enforced here, not only in the navigation: a redirect on the layout is a
  // convenience, and this is the check that holds if the URL is typed directly.
  await guardAdminPage("view_businesses");

  const businesses = await listBusinessesForAdmin();
  const overview = summarize(businesses);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="All businesses" action={<Link href="/admin/custom-projects" prefetch={false} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold">Custom clients<ArrowUpRight size={14} aria-hidden="true" /></Link>} />
      <p className="-mt-2 text-sm text-ink-muted">
        Every business on JKTL Business, at a glance — account and plan status only. Customer, booking and sales
        records stay inside each business&apos;s own dashboard.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Businesses" value={overview.totalBusinesses.toLocaleString()} />
        <StatTile label="Published sites" value={overview.publishedCount.toLocaleString()} rule="info" />
        <StatTile label="Active subscriptions" value={overview.activeSubscriptions.toLocaleString()} rule="accent" />
        <StatTile label="Total storage used" value={formatGb(overview.totalStorageUsedBytes)} rule="danger" />
      </div>
      <StatTile label="Combined recorded revenue (all businesses)" value={formatKobo(overview.totalRevenueKobo)} />

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/support/care" prefetch={false} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Customer setup & follow-up</Link>
        <Link href="/admin/emails/renewals" prefetch={false} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Renewals & reminders</Link>
      </div>
      <details className="rounded-xl border border-border bg-paper p-4">
        <summary className="cursor-pointer text-sm font-semibold">Integration health</summary>
        <div className="mt-3"><IntegrationHealth /></div>
      </details>

      <AdminBusinessTable businesses={businesses} />
    </div>
  );
}
