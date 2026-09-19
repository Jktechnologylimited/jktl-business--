import { PageHeader } from "@/components/app/page-header";
import { StatTile } from "@/components/app/stat-tile";
import { AdminBusinessTable } from "@/components/admin/business-table";
import { listBusinessesForAdmin, summarize } from "@/lib/db/admin";
import { formatKobo, formatMb } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const businesses = await listBusinessesForAdmin();
  const overview = summarize(businesses);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="All businesses" />
      <p className="-mt-2 text-sm text-ink-muted">
        Every business on JKTL Business, at a glance — account and plan status only. Customer, booking and sales
        records stay inside each business&apos;s own dashboard.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Businesses" value={overview.totalBusinesses.toLocaleString()} />
        <StatTile label="Published sites" value={overview.publishedCount.toLocaleString()} rule="info" />
        <StatTile label="Active subscriptions" value={overview.activeSubscriptions.toLocaleString()} rule="accent" />
        <StatTile label="Total storage used" value={formatMb(overview.totalStorageUsedBytes)} rule="danger" />
      </div>
      <StatTile label="Combined recorded revenue (all businesses)" value={formatKobo(overview.totalRevenueKobo)} />

      <AdminBusinessTable businesses={businesses} />
    </div>
  );
}
