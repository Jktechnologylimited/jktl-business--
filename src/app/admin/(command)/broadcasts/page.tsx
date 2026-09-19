import { PageHeader } from "@/components/app/page-header";
import { BroadcastForm } from "@/components/admin/broadcast-form";
import { listBroadcasts } from "@/lib/db/admin";

export const dynamic = "force-dynamic";

export default async function AdminBroadcastsPage() {
  const history = await listBroadcasts();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Broadcasts" />
      <p className="-mt-2 text-sm text-ink-muted">
        Send a push notification to every business that has push turned on — downtime notices, promotions, anything platform-wide. A
        business can opt out of these separately from their own booking/stock alerts, in Settings → Notifications.
      </p>
      <BroadcastForm initialHistory={history} />
    </div>
  );
}
