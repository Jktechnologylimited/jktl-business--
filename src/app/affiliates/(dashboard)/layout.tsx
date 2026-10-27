import { OperationsFrame } from "@/components/admin/operations-frame";
import { redirect, unstable_rethrow } from "next/navigation";
import { AffiliateLanding } from "@/components/affiliates/affiliate-landing";
import { getAffiliateSession } from "@/lib/affiliate-session";
import { affiliateLogoutAction } from "@/lib/actions/affiliate-actions";

/**
 * Guards everything under `/affiliates` except `/affiliates/login` and
 * `/affiliates/apply`, which are siblings outside this `(dashboard)` group.
 *
 * **A visitor who is not signed in sees the programme, not a login form.** This
 * used to redirect straight to `/affiliates/login`, which meant the URL the
 * marketing site sends partners to — `jktl.com.ng/affiliate` — led to a password
 * prompt for an account they had no way to create. The application page existed
 * at `/affiliates/apply` and nothing pointed at it.
 *
 * Rendering the landing page instead of `children` also means a guarded page's
 * data fetch never runs for an anonymous visitor, so there is no wasted query and
 * no half-rendered dashboard.
 *
 * No client store, no offline or demo mode: this only ever talks to the real
 * database.
 */
export const dynamic = "force-dynamic";

export default async function AffiliateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // A failed session lookup must never take the public page down. An expired or
  // stale cookie, or a database blip, should show the programme — which is also
  // the honest answer, because the visitor is not demonstrably signed in.
  //
  // `unstable_rethrow` first, because `cookies()` signals "this route is dynamic"
  // by *throwing*, and swallowing that would tell Next this page can be rendered
  // once and cached. A cached landing page served to a signed-in partner is a
  // nasty bug to chase, and it is exactly what a bare `.catch()` here would cause.
  const affiliate = await getAffiliateSession().catch((err) => {
    unstable_rethrow(err);
    console.error("affiliate session lookup failed:", err);
    return null;
  });
  if (!affiliate) return <AffiliateLanding />;
  if (affiliate.programme === "partner") redirect("/partners");

  return (
    <OperationsFrame
      kind="affiliate"
      name={affiliate.name}
      role="JKTL Affiliate"
      nav={[
        { href: "/affiliates", label: "Overview" },
        {
          href: "/affiliates/commercial",
          label: "Referrals & Earnings",
        },
        { href: "/affiliates/resources", label: "Marketing Materials" },
        { href: "/affiliates/support", label: "Support" },
        { href: "/affiliates/settings", label: "Settings" },
      ]}
      logout={affiliateLogoutAction}
    >
      {children}
    </OperationsFrame>
  );
}
