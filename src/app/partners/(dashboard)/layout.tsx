import { ThemeControl } from "@/components/settings/theme-control";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAffiliateSession } from "@/lib/affiliate-session";
import { query } from "@/lib/custom/service";
import { affiliateLogoutAction } from "@/lib/actions/affiliate-actions";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await getAffiliateSession();
  if (!s) redirect("/partners/login");
  if (
    !(
      await query(
        "SELECT 1 FROM affiliates WHERE id=$1 AND programme='partner' AND status='active' AND partner_terms_confirmed=true",
        [s.id],
      )
    ).length
  )
    redirect("/partners/login");
  return (
    <div className="min-h-dvh bg-paper">
      <header className="bg-[#060e2a] px-6 py-8 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5">
          <div>
            <p className="text-xs tracking-widest text-[#c9a84c]">
              JKTL PARTNERS
            </p>
            <h1 className="mt-2 text-2xl">
              Your relationships. Shared growth.
            </h1>
            <p className="mt-2 text-sm text-white/65">{s.name}</p>
          </div>
          <div className="flex items-center gap-5 text-sm"><ThemeControl />
            <Link href="https://jktl.com.ng/partners">Programme</Link>
            <Link href="/partners/workspace">Workspace</Link>
            <Link href="/partners/support">Support</Link>
            <Link href="/partners/clients">Clients</Link>
            <Link href="/business/distribution">Business account</Link>
            <form action={affiliateLogoutAction}>
              <button>Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
