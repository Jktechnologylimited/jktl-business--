import {
  BriefcaseBusiness,
  Headset,
  Megaphone,
  Handshake,
  NotebookPen,
  Crown,
} from "lucide-react";
const functions = [
  {
    title: "Customer Success & Support",
    Icon: Headset,
    work: "Onboarding, website setup, customer issues, renewals follow-up and retention.",
  },
  {
    title: "Growth & Gaming",
    Icon: Megaphone,
    work: "Marketing, acquisition, games engagement and community growth.",
  },
  {
    title: "Affiliate & Partner Operations",
    Icon: Handshake,
    work: "Recruitment, onboarding, programme support and performance follow-up.",
  },
  {
    title: "Editorial & Communications",
    Icon: NotebookPen,
    work: "Articles, announcements, knowledge-base content and customer email content.",
  },
];
export function TeamOrganogram() {
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
          Four functions coordinate through the Executive Associate, who reports to the Founder.
        </p>
      </div>
      <div className="mx-auto max-w-md rounded-xl border border-primary/40 bg-primary/5 p-5 text-center">
        <Crown
          className="mx-auto mb-2 size-6 text-primary"
          aria-hidden="true"
        />
        <h3 className="font-semibold text-ink">Founder</h3>
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
        <h3 className="font-semibold text-ink">Executive Associate</h3>
        <p className="text-sm text-ink-muted">
          Reports to the Founder
        </p>
        <p className="mt-2 text-xs leading-6 text-ink-muted">
          Daily coordination, team follow-up, operational reporting and
          escalation.
        </p>
      </div>
      <div aria-hidden="true" className="mx-auto h-7 w-px bg-primary/50" />
      <ul
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        aria-label="Functions reporting to the Executive Associate"
      >
        {functions.map(({ title, Icon, work }) => (
            <li
              key={title}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <Icon className="mb-3 size-5 text-primary" aria-hidden="true" />
              <h3 className="font-semibold text-ink">{title}</h3>
              <p className="mt-1 text-xs text-primary">Reports to the Executive Associate</p>
              <p className="mt-3 text-sm leading-6 text-ink-muted">{work}</p>
            </li>
        ))}
      </ul>
      <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
        {[
          {
            title: "Daily",
            text: "Each function sends priorities, progress and blockers to the Executive Associate.",
          },
          {
            title: "Weekly",
            text: "The Executive Associate consolidates progress, customer issues and decisions needed from the Founder.",
          },
          {
            title: "Monthly",
            text: "The Founder reviews performance and sets priorities with the team.",
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
