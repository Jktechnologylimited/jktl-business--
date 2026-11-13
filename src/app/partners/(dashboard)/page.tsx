import Link from "next/link";
import { ArrowUpRight,
  ArrowRight,
  Plus,
  Globe,
  Users,
  Clock,
  CircleHelp,
} from "lucide-react";
import { approvedPartner } from "@/lib/partners/access";
import { query } from "@/lib/custom/service";
import { partnerDashboardClients } from "@/lib/partners/dashboard";
import {
  clientStage,
  STAGE_LABELS,
  safeWebsiteUrl,
  PARTNER_STEPS,
} from "@/lib/partners/workflow";
export const dynamic = "force-dynamic";
export default async function Overview() {
  const p = await approvedPartner();
  const [clients, tickets] = await Promise.all([
    partnerDashboardClients(p.id),
    query(
      "SELECT count(*)::int open FROM partner_tickets WHERE partner_id=$1 AND status NOT IN('RESOLVED','CLOSED')",
      [p.id],
    ),
  ]);
  const published = clients.filter(
      (c) => clientStage(c) === "published",
    ).length,
    waiting = clients.filter((c) => !c.organization_id).length;
  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Your client studio
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            Good to see you, {p.name.split(" ")[0]}.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-muted">
            Build a stronger online presence for every client, from their first
            website to their next stage of growth.
          </p>
        </div>
        <Link
          href="/partners/workspace?new=1#new-client"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary"
        >
          <Plus size={18} />
          Create client
        </Link>
      </header>
      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Client portfolio summary"
      >
        {[
          ["Client workspaces", clients.length, Users],
          ["Published client sites", published, Globe],
          ["Awaiting owner approval", waiting, Clock],
          ["Open support tickets", Number(tickets[0]?.open || 0), CircleHelp],
        ].map(([label, value, Icon]) => {
          const I = Icon as typeof Users;
          return (
            <article
              key={String(label)}
              className="rounded-2xl border border-border bg-paper p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-ink-muted">{String(label)}</p>
                <I size={18} className="text-ink-muted" />
              </div>
              <p className="mt-4 text-3xl font-semibold">{String(value)}</p>
            </article>
          );
        })}
      </section>
      <section className="rounded-3xl bg-[#060e2a] p-6 text-white sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#c9a84c]">
          From a business idea to a live website
        </p>
        <h2 className="mt-3 text-2xl font-semibold">
          A clear path for every client.
        </h2>
        <ol className="mt-7 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {PARTNER_STEPS.map(([n, title, text]) => (
            <li key={n}>
              <span className="text-sm font-semibold text-[#c9a84c]">{n}</span>
              <h3 className="mt-2 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/70">{text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 border-t border-white/15 pt-5 text-xs leading-6 text-white/70">
          Drafting is free. The client keeps account ownership and grants access
          before publishing. Paid products follow their own checkout and billing
          approval.
        </p>
      </section>
      <section className="rounded-2xl border border-border bg-paper p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Continue working</h2>
          <Link
            href="/partners/workspace"
            className="text-sm font-semibold text-blue-600 underline"
          >
            All clients & websites
          </Link>
        </div>
        {clients.length ? (
          <div className="divide-y divide-border">
            {clients.slice(0, 6).map((c) => {
              const stage = clientStage(c),
                url = safeWebsiteUrl(c.subdomain);
              return (
                <article
                  key={String(c.id)}
                  className="flex flex-wrap items-center justify-between gap-4 py-4"
                >
                  <div>
                    <h3 className="font-semibold">{String(c.business_name)}</h3>
                    <p className="mt-2 text-xs text-ink-muted">
                      {STAGE_LABELS[stage]}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        View live site <ArrowUpRight size={16} className="inline-block align-middle" aria-hidden="true" />
                      </a>
                    )}
                    <Link
                      href={"/partners/workspace?id=" + c.id}
                      className="inline-flex items-center gap-2 font-semibold text-primary"
                    >
                      {stage === "published"
                        ? "Manage client"
                        : "Continue setup"}
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl bg-surface p-6">
            <h3 className="font-semibold">Your first client starts here.</h3>
            <p className="my-3 max-w-xl text-sm leading-7 text-ink-muted">
              Add their business details and choose a website design. You can
              prepare the draft before inviting the owner to sign in and approve
              your access.
            </p>
            <Link
              href="/partners/workspace?new=1#new-client"
              className="font-semibold text-blue-600 underline"
            >
              Create your first client →
            </Link>
          </div>
        )}
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          [
            "/partners/billing",
            "Services & payments",
            "Review client service quotes, billing responsibility and secure payment routes.",
          ],
          [
            "/help?topic=partners",
            "Partner knowledge base",
            "Step-by-step guides for client websites, permissions and commercial terms.",
          ],
          [
            "/partners/support",
            "We’re here to help",
            "Get assistance with client setup, domain orders or a publishing issue.",
          ],
        ].map(([href, title, text]) => (
          <Link
            key={href}
            href={href}
            className="rounded-2xl border border-border bg-paper p-5"
          >
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-ink-muted">{text}</p>
          </Link>
        ))}
      </div>
      <p className="text-xs leading-6 text-ink-muted">
        Published-site counts include client websites you currently have
        permission to view. Your signed agreement controls eligible commissions
        and reseller terms.
      </p>
    </div>
  );
}
