import Link from "next/link";
import { approvedPartner } from "@/lib/partners/access";
import { query } from "@/lib/custom/service";
export const dynamic = "force-dynamic";
export default async function Overview() {
  const p = await approvedPartner();
  const [w, c, t] = await Promise.all([
    query(
      `SELECT count(*)::int AS total,count(*) FILTER(WHERE organization_id IS NULL)::int AS drafts,count(*) FILTER(WHERE template_id<>'')::int AS designed FROM partner_workspaces WHERE partner_id=$1`,
      [p.id],
    ),
    query(
      "SELECT count(*)::int AS active FROM partner_client_access WHERE partner_id=$1 AND revoked_at IS NULL",
      [p.id],
    ),
    query(
      "SELECT count(*)::int AS open FROM partner_tickets WHERE partner_id=$1 AND status NOT IN('RESOLVED','CLOSED')",
      [p.id],
    ),
  ]);
  return (
    <div className="space-y-7 text-ink">
      <h1 className="text-3xl font-semibold">Your agency workspace</h1>
      <p>
        Create client drafts, build with the JKTL template library, obtain owner
        permission and coordinate services with JKTL.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Client workspaces", w[0]?.total],
          ["Awaiting owner", w[0]?.drafts],
          ["Active relationships", c[0]?.active],
          ["Open support tickets", t[0]?.open],
        ].map(([label, n]) => (
          <article
            key={String(label)}
            className="rounded-xl border border-border bg-surface p-5"
          >
            <p className="text-sm text-ink-muted">{String(label)}</p>
            <strong className="mt-3 block text-3xl">{String(n || 0)}</strong>
          </article>
        ))}
      </div>
      <nav className="grid gap-4 sm:grid-cols-2">
        {[
          [
            "/partners/workspace",
            "Create client / set up website",
            "Prepare drafts, browse the shared templates and switch clients.",
          ],
          [
            "/partners/clients",
            "Clients & service requests",
            "Track authorized relationships and request domain or email assistance.",
          ],
          [
            "/partners/support",
            "Contact JKTL support",
            "Track client-related tickets and staff replies.",
          ],
          [
            "/partners/earnings",
            "Earnings & payouts",
            "Your existing commissions, verified payout details and payment history.",
          ],
          [
            "/partners/playbook",
            "Training resources",
            "Programme guidance and responsible marketing.",
          ],
          [
            "/business/distribution",
            "Account & permissions",
            "Connect your Business identity and manage owner permissions.",
          ],
        ].map(([href, title, text]) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border border-border p-5"
          >
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-3 text-sm text-ink-muted">{text}</p>
          </Link>
        ))}
      </nav>
      <p className="text-sm text-ink-muted">
        Your signed agreement controls eligible commissions and reseller terms.
        Client platform fees are separate from independently agreed
        implementation fees. No client is charged merely because you prepare a
        draft or request a service.
      </p>
    </div>
  );
}
