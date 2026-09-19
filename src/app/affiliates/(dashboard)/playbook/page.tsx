import { PageHeader } from "@/components/app/page-header";

/**
 * A self-contained "how to actually earn from this" guide for affiliates —
 * adapted from general social-media-growth frameworks into JKTL-specific,
 * referral-focused examples, per the request that started this: affiliates
 * need something they can act on today, not a theory lesson. The content
 * itself is a hardcoded constant (no DB read) since it's the same for
 * every affiliate, but the page still renders dynamically — it inherits
 * the `(dashboard)` layout's cookie-based session check, so it must not be
 * forced static (that would let the layout's redirect-if-signed-out guard
 * get skipped on a cached hit).
 */

interface Framework {
  name: string;
  description: string;
  templates: string[];
  example: string;
}

interface SocialLink {
  label: string;
  href: string;
}

/**
 * JKTL's own official page links, shown to every affiliate as the fastest
 * possible content: reshare what we already post instead of always making
 * something original. Fill these in with the real URLs — e.g.
 * `{ label: "Instagram", href: "https://instagram.com/jktlbusiness" }` —
 * and the "follow & reshare" card below appears automatically. Leave the
 * array empty and that card just hides itself rather than showing dead
 * links.
 */
const SOCIAL_LINKS: SocialLink[] = [];

const FRAMEWORKS: Framework[] = [
  {
    name: "Education",
    description: "Teach one small, specific thing. This is the easiest angle to start with.",
    templates: ["How to ___ in ___ minutes", "Beginner's guide to ___", "3 mistakes people make with ___"],
    example: "“How to get your business a free website in 10 minutes”",
  },
  {
    name: "Authority",
    description: "Say something a small-business owner wishes someone had told them sooner.",
    templates: ["Nobody tells you this about ___", "The truth about ___", "Stop doing this if you want ___"],
    example: "“Nobody tells small business owners this: most of the software you need is free”",
  },
  {
    name: "Relatable",
    description: "A moment every Nigerian small-business owner recognises instantly.",
    templates: ["POV: you're a business owner and ___", "Only business owners will understand this", "You know you run a small business when ___"],
    example: "“POV: a customer asks ‘do you have a website?’ and you finally say yes”",
  },
  {
    name: "Storytelling",
    description: "A real before/after — yours, or a business you know.",
    templates: ["How [business] went from ___ to ___", "I tried ___ for 7 days, here's what happened"],
    example: "“How this hair salon went from a WhatsApp catalogue to a real website in one week”",
  },
  {
    name: "List / value-packed",
    description: "Quick, save-able, shareable. These tend to travel furthest.",
    templates: ["3 free tools every small business needs", "5 things to sort out before you open a shop"],
    example: "“3 free tools every Nigerian small business needs in 2026”",
  },
  {
    name: "Pattern-break",
    description: "A confident, slightly contrarian claim. Use sparingly — it works because it's rare.",
    templates: ["You don't need ___ to ___", "___ is overrated (here's what actually works)"],
    example: "“You don't need ₦500k to get your business online”",
  },
];

const CHALLENGE = [
  { day: "Day 1", task: "Post one Education piece — a quick how-to." },
  { day: "Day 2", task: "Post one Authority piece — something you wish you'd known." },
  { day: "Day 3", task: "Post one Relatable piece — a business-owner moment." },
  { day: "Day 4", task: "Post one Storytelling piece — a real before/after." },
  { day: "Day 5", task: "Post one List piece — quick, save-able value." },
  { day: "Day 6", task: "Post one Pattern-break piece — a confident, contrarian line." },
  { day: "Day 7", task: "Check your Dashboard tab — how many clicks and sign-ups did the week bring?" },
];

export default function AffiliatePlaybookPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Your affiliate playbook" />
      <p className="-mt-2 text-sm text-ink-muted">
        You earn a recurring commission every time someone subscribes through your link — for as long as they stay
        subscribed. This page is everything you need to start today, from resharing what we already post to making
        your own content.
      </p>

      <section className="rounded-2xl border border-border p-4">
        <h2 className="font-display text-sm font-semibold text-ink">How this actually earns you money</h2>
        <ol className="mt-3 flex flex-col gap-2 text-sm text-ink-muted">
          <li><span className="font-semibold text-ink">1. Post content that gets attention.</span> Doesn&apos;t need to be fancy — reshare ours (below) or use the frameworks further down.</li>
          <li><span className="font-semibold text-ink">2. Point people to your link.</span> It&apos;s on your Dashboard tab — put it in your bio, caption, or a pinned comment. Mentioning <span className="font-medium text-ink">jktl.com.ng</span> by name first — our main website — is an easy way to build trust before you drop it.</li>
          <li><span className="font-semibold text-ink">3. Get paid for as long as they stay subscribed.</span> One sign-up can pay you every month for years — this isn&apos;t a one-time bounty.</li>
        </ol>
      </section>

      <section className="rounded-2xl border border-border p-4">
        <h2 className="font-display text-sm font-semibold text-ink">Know what you&apos;re promoting</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Not sure what to say? Open your own referral link (on your Dashboard tab) in a browser and walk through it
          yourself, as if you were a new customer signing up. Seeing it firsthand is the fastest way to talk about it
          confidently.
        </p>
      </section>

      <section className="rounded-2xl border border-border p-4">
        <h2 className="font-display text-sm font-semibold text-ink">Your ₦2,000 welcome bonus</h2>
        <p className="mt-1 text-xs text-ink-muted">
          On top of your regular commission, you get a one-time ₦2,000 bonus the moment your first referred business
          upgrades to a paid subscription — no extra step, it just lands in your balance. Once you have a balance,
          request a payout from your Dashboard tab from the 21st of each month; add your (Paystack-verified) bank
          details there first so it&apos;s ready to go.
        </p>
      </section>

      <section className="rounded-2xl border border-border p-4">
        <h2 className="font-display text-sm font-semibold text-ink">The fastest content: follow &amp; reshare us</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Before you make anything of your own, follow JKTL&apos;s official pages and reshare what we post — to your
          WhatsApp Status, as a Reel share, a retweet. It costs no creativity and keeps your feed consistent with the
          brand you&apos;re representing. Do this alongside your own posts below, not instead of them.
        </p>
        {SOCIAL_LINKS.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {SOCIAL_LINKS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary"
              >
                {s.label}
              </a>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border p-4">
        <h2 className="font-display text-sm font-semibold text-ink">Two ways to show up</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-surface p-3">
            <div className="text-sm font-semibold text-ink">Face content</div>
            <p className="mt-1 text-xs text-ink-muted">You on camera — talking, explaining, showing. Builds trust faster and is easier to turn into sign-ups, but takes more confidence and consistency.</p>
          </div>
          <div className="rounded-xl bg-surface p-3">
            <div className="text-sm font-semibold text-ink">Faceless content</div>
            <p className="mt-1 text-xs text-ink-muted">Text-on-screen, voiceover, screenshots. Easier to start and scale, but takes a little longer to build trust. Both work — pick whichever you&apos;ll actually keep doing.</p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold text-ink">6 angles that work — pick one at a time</h2>
        {FRAMEWORKS.map((f) => (
          <div key={f.name} className="rounded-2xl border border-border p-4">
            <div className="text-sm font-semibold text-ink">{f.name}</div>
            <p className="mt-1 text-xs text-ink-muted">{f.description}</p>
            <ul className="mt-2 flex flex-col gap-1 text-xs text-ink-muted">
              {f.templates.map((t) => (
                <li key={t}>&ldquo;{t}&rdquo;</li>
              ))}
            </ul>
            <p className="mt-2 text-xs font-medium text-primary">Example: {f.example}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-border p-4">
        <h2 className="font-display text-sm font-semibold text-ink">Where to post</h2>
        <dl className="mt-3 flex flex-col gap-3 text-sm">
          <div>
            <dt className="font-semibold text-ink">TikTok / Instagram Reels</dt>
            <dd className="text-xs text-ink-muted">Hook in the first 2 seconds, keep it under 60 seconds, post consistently. Link goes in your bio.</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Facebook</dt>
            <dd className="text-xs text-ink-muted">Reaches an older, more business-owner-heavy audience — good for longer explainer posts and small-business Facebook groups.</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">WhatsApp Status</dt>
            <dd className="text-xs text-ink-muted">The most direct channel you have — no algorithm. A short caption and your link, shared daily, reaches everyone who already knows and trusts you.</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-border p-4">
        <h2 className="font-display text-sm font-semibold text-ink">Your 7-day launch challenge</h2>
        <p className="mt-1 text-xs text-ink-muted">One post a day, one angle a day. By day 7 you&apos;ll have tried every framework above and know which one fits you.</p>
        <ol className="mt-3 flex flex-col gap-2">
          {CHALLENGE.map((c) => (
            <li key={c.day} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">{c.day}</span>
              <span className="text-ink-muted">{c.task}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
