import Link from "next/link";
import { guardAdminPage } from "@/lib/admin-page-guard";
import { PageHeader } from "@/components/app/page-header";
import { AffiliateManager } from "@/components/admin/affiliate-manager";
import {
  listAffiliatesWithStats,
  listPendingPayoutRequests,
} from "@/lib/db/affiliates";

export const dynamic = "force-dynamic";

// Same env-based helper as billing-actions.ts / affiliate-actions.ts —
// deliberately NOT derived from the request's Host header, so a referral
// link always points at the real production domain even if the command
// center itself is ever accessed via a preview or staging URL.
function appOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng";
  return `https://business.${root}`;
}

export default async function AdminAffiliatesPage() {
  // Enforced here, not only in the navigation: a redirect on the layout is a
  // convenience, and this is the check that holds if the URL is typed directly.
  await guardAdminPage("manage_affiliates");

  const [affiliates, payoutRequests] = await Promise.all([
    listAffiliatesWithStats(),
    listPendingPayoutRequests(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Affiliates" />
      <p className="-mt-2 text-sm text-ink-muted">
        Manage accounts, accepted agreements, referrals and earned payouts.
        Existing entitlements follow each participant’s agreement. New proposals
        require participant acceptance and formal activation. Transfers are
        recorded only after the actual bank payment is confirmed.
      </p>
      <Link className="underline" href="/admin/affiliates/invitations">
        Invite an Affiliate
      </Link>
      <div id="accounts" />
      <AffiliateManager
        initialAffiliates={affiliates.filter((a) => a.programme !== "partner")}
        initialPayoutRequests={payoutRequests}
        origin={appOrigin()}
      />
    </div>
  );
}
