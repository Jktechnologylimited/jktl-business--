import {
  BriefcaseBusiness,
  Headset,
  Megaphone,
  Handshake,
  NotebookPen,
  Crown,
} from "lucide-react";
import type { AdminRole } from "@/lib/admin-permissions";
type Member = { name: string; role: AdminRole };
const functions = [
  {
    title: "Customer Success & Support",
    roles: ["support"],
    Icon: Headset,
    work: "Onboarding, website setup, customer issues, renewals follow-up and retention.",
  },
  {
    title: "Growth & Gaming",
    roles: ["growth_gaming_lead"],
    Icon: Megaphone,
    work: "Marketing, acquisition, games engagement and community growth.",
  },
  {
    title: "Affiliate & Partner Operations",
    roles: ["affiliate_manager"],
    Icon: Handshake,
    work: "Recruitment, onboarding, programme support and performance follow-up.",
  },
  {
    title: "Editorial & Communications",
    roles: ["writer", "editor"],
    Icon: NotebookPen,
    work: "Articles, announcements, knowledge-base content and customer email content.",
  },
];
export function TeamOrganogram({ members = [] }: { members?: Member[] }) {
  const associates = members.filter((m) => m.role === "executive_associate");
  return (
    <section
      aria-labelledby="team-structure-title"
      className="rounded-2xl border border-border bg-paper p-5 sm:p-8"
    >
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          How we work
        </p>
        <h2
          id="team-structure-title"
          className="mt-2 font-display text-2xl font-semibold text-ink"
        >
          JKTL team structure
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Four functions coordinate through Beke. Beke reports to John.
        </p>
      </div>
      <div className="mx-auto max-w-md rounded-xl border border-primary/40 bg-primary/5 p-5 text-center">
        <Crown
          className="mx-auto mb-2 size-6 text-primary"
          aria-hidden="true"
        />
        <h3 className="font-semibold text-ink">John</h3>
        <p className="text-sm text-ink-muted">Founder</p>
        <p className="mt-2 text-xs leading-6 text-ink-muted">
          Company direction, financial decisions and final approvals.
        </p>
      </div>
      <div aria-hidden="true" className="mx-auto h-7 w-px bg-primary/50" />
      <div className="mx-auto max-w-md rounded-xl border border-primary/40 bg-surface p-5 text-center">
        <BriefcaseBusiness
          className="mx-auto mb-2 size-6 text-primary"
          aria-hidden="true"
        />
        <h3 className="font-semibold text-ink">Beke</h3>
        <p className="text-sm text-ink-muted">
          Executive Associate · reports to John
        </p>
        <p className="mt-2 text-xs leading-6 text-ink-muted">
          Daily coordination, team follow-up, operational reporting and
          escalation.
        </p>
        {associates.length ? (
          <p className="mt-3 text-xs text-primary">
            Active role accounts: {associates.map((m) => m.name).join(", ")}
          </p>
        ) : (
          <p className="mt-3 text-xs text-ink-faint">
            Account access awaits an Executive Associate invitation.
          </p>
        )}
      </div>
      <div aria-hidden="true" className="mx-auto h-7 w-px bg-primary/50" />
      <ul
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        aria-label="Functions reporting to Beke"
      >
        {functions.map(({ title, roles, Icon, work }) => {
          const assigned = members.filter((m) => roles.includes(m.role));
          return (
            <li
              key={title}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <Icon className="mb-3 size-5 text-primary" aria-hidden="true" />
              <h3 className="font-semibold text-ink">{title}</h3>
              <p className="mt-1 text-xs text-primary">Reports to Beke</p>
              <p className="mt-3 text-sm leading-6 text-ink-muted">{work}</p>
              {assigned.length > 0 && (
                <p className="mt-3 border-t border-border pt-3 text-xs text-ink-muted">
                  {assigned.map((m) => m.name).join(", ")}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
        {[
          {
            title: "Daily",
            text: "Each function sends priorities, progress and blockers to Beke.",
          },
          {
            title: "Weekly",
            text: "Beke consolidates progress, customer issues and decisions needed for John.",
          },
          {
            title: "Monthly",
            text: "John reviews performance and sets priorities with the team.",
          },
        ].map((item) => (
          <div key={item.title}>
            <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
            <p className="mt-1 text-xs leading-6 text-ink-muted">{item.text}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-xs leading-6 text-ink-faint">
        Reporting lines do not grant system access. Invitations and account
        roles control permissions. Financial changes, payouts, team access and
        security settings stay with the authorised role.
      </p>
    </section>
  );
}
