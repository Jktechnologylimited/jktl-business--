import Link from "next/link";
import { BookOpen, ArrowRight, Search, LifeBuoy } from "lucide-react";
import type { HelpGuide } from "@/lib/support/knowledge";
import {
  TOPICS,
  topicFor,
  searchArticles,
  relatedArticles,
} from "@/lib/knowledge/catalog";
export function KnowledgeIndex({
  articles,
  q = "",
  topic = "all",
  base = "/help",
  team = false,
}: {
  articles: HelpGuide[];
  q?: string;
  topic?: string;
  base?: string;
  team?: boolean;
}) {
  const matches = searchArticles(articles, q, topic),
    topics = TOPICS.filter((t) => articles.some((g) => topicFor(g) === t[0]));
  return (
    <div className="space-y-8 text-ink" style={{ overflowWrap: "anywhere" }}>
      <header className="rounded-3xl bg-[#060e2a] px-6 py-9 text-white sm:p-10">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#c9a84c]">
          <BookOpen size={18} />
          JKTL KNOWLEDGE BASE
        </p>
        <h1 className="mt-5 max-w-3xl text-3xl font-semibold sm:text-4xl">
          {team
            ? "The Team’s platform playbook."
            : "Clear answers. Confident next steps."}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/80">
          {team
            ? "Operating guides for customer care, commercial programmes, services, content and reporting. Your assigned permissions still govern every action."
            : "Find detailed instructions for your website, domains, email, business tools, partner programmes and more. Explore freely, then sign in when you need account-specific help."}
        </p>
        <p className="mt-5 text-xs text-white/70">
          {articles.length} practical guides · Steps, troubleshooting and
          escalation · Reviewed 8 November 2026
        </p>
      </header>
      <form
        action={base}
        method="get"
        className="grid gap-4 rounded-2xl border border-border bg-paper p-5 sm:grid-cols-[1fr_auto]"
        role="search"
      >
        <label className="text-sm font-medium">
          Search the knowledge base
          <div className="relative mt-2">
            <Search
              className="pointer-events-none absolute left-3 top-3.5 text-ink-muted"
              size={18}
            />
            <input
              type="search"
              name="q"
              defaultValue={q}
              maxLength={200}
              placeholder="Try publish, partner percentage or renewal"
              className="w-full rounded-xl border border-border-strong bg-paper py-3 pl-10 pr-3 text-ink"
            />
          </div>
        </label>
        <label className="text-sm font-medium">
          Topic
          <select
            name="topic"
            defaultValue={topic}
            className="mt-2 block w-full rounded-xl border border-border-strong bg-paper p-3 text-ink"
          >
            <option value="all">All topics</option>
            {topics.map((t) => (
              <option key={t[0]} value={t[0]}>
                {t[1]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-4 sm:col-span-2">
          <button className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary">
            Search guides
          </button>
          {(q || topic !== "all") && (
            <Link
              href={base}
              className="self-center text-sm text-blue-600 underline"
            >
              Clear filters
            </Link>
          )}
        </div>
      </form>
      {!q && topic === "all" && (
        <section aria-labelledby="topics">
          <h2 id="topics" className="mb-4 text-xl font-semibold">
            Browse by topic
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((t) => (
              <Link
                key={t[0]}
                href={`${base}?topic=${t[0]}`}
                className="rounded-2xl border border-border bg-paper p-5 transition hover:border-accent focus-visible:outline-2 focus-visible:outline-primary"
              >
                <h3 className="font-semibold">{t[1]}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-muted">{t[2]}</p>
                <p className="mt-4 text-xs text-ink-muted">
                  {articles.filter((g) => topicFor(g) === t[0]).length} guides →
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section aria-labelledby="articles">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="articles" className="text-xl font-semibold">
            {q
              ? `Results for “${q}”`
              : topic === "all"
                ? "All guides"
                : TOPICS.find((t) => t[0] === topic)?.[1]}
          </h2>
          <p role="status" className="text-sm text-ink-muted">
            {matches.length} {matches.length === 1 ? "guide" : "guides"}
          </p>
        </div>
        {matches.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {matches.map((g) => (
              <Link
                href={`${base}/${g.id}`}
                key={g.id}
                className="group flex flex-col rounded-2xl border border-border bg-paper p-5 transition hover:border-accent focus-visible:outline-2 focus-visible:outline-primary"
              >
                <p className="text-xs font-medium text-ink-muted">
                  {TOPICS.find((t) => t[0] === topicFor(g))?.[1]}
                </p>
                <h3 className="mt-2 text-lg font-semibold group-hover:text-primary">
                  {g.title}
                </h3>
                <p className="mb-5 mt-3 text-sm leading-6 text-ink-muted">
                  {g.summary}
                </p>
                <span className="mt-auto flex items-center gap-2 text-sm font-semibold text-primary">
                  Read guide <ArrowRight size={16} />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-paper p-6">
            <h3 className="font-semibold">No matching guide yet</h3>
            <p className="mt-2 text-sm text-ink-muted">
              Try fewer words, choose another topic or ask support. Do not share
              passwords, payment secrets or invitation tokens.
            </p>
            <Link
              className="mt-4 inline-block text-blue-600 underline"
              href={team ? "/admin/support" : "/business/help"}
            >
              Open support
            </Link>
          </div>
        )}
      </section>
      <aside className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <LifeBuoy size={20} />
          Need help with your account?
        </h2>
        <p className="my-3 text-sm leading-7 text-ink-muted">
          A guide explains the workflow; it cannot verify a payment, change
          account access or confirm fulfillment. Sign in and send the relevant
          screen and error to the support team.
        </p>
        <div className="flex flex-wrap gap-5 text-sm font-semibold">
          <Link
            className="text-blue-600 underline"
            href={team ? "/admin/support" : "/business/help"}
          >
            {team ? "Support inbox" : "Business help & support"}
          </Link>
          <Link className="text-blue-600 underline" href="/partners/login">
            Partner sign in
          </Link>
          <Link className="text-blue-600 underline" href="/affiliates/login">
            Affiliate sign in
          </Link>
          {team && (
            <Link className="text-blue-600 underline" href="/help">
              Public knowledge base
            </Link>
          )}
        </div>
      </aside>
    </div>
  );
}
export function KnowledgeArticle({
  guide,
  articles,
  base = "/help",
  team = false,
}: {
  guide: HelpGuide;
  articles: HelpGuide[];
  base?: string;
  team?: boolean;
}) {
  const related = relatedArticles(guide, articles),
    topic = TOPICS.find((t) => t[0] === topicFor(guide));
  return (
    <div className="space-y-8 text-ink" style={{ overflowWrap: "anywhere" }}>
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap gap-2 text-sm text-ink-muted"
      >
        <Link href={base} className="text-blue-600 underline">
          Knowledge base
        </Link>
        <span>/</span>
        <Link
          href={`${base}?topic=${topicFor(guide)}`}
          className="text-blue-600 underline"
        >
          {topic?.[1]}
        </Link>
      </nav>
      <article className="rounded-3xl border border-border bg-paper p-5 sm:p-9">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {team ? "Team guide" : "JKTL PLATFORM GUIDE"}
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
            {guide.title}
          </h1>
          <p className="mt-5 text-base leading-8 text-ink-muted">
            {guide.summary}
          </p>
          <p className="mt-4 text-xs text-ink-muted">
            Reviewed 8 November 2026 · {guide.steps.length} steps ·{" "}
            {team ? "Team access required" : "No signup required to read"}
          </p>
        </header>
        <nav
          aria-label="On this page"
          className="my-7 flex flex-wrap gap-4 border-y border-border py-4 text-sm"
        >
          <a href="#steps" className="text-blue-600 underline">
            Step by step
          </a>
          <a href="#troubleshooting" className="text-blue-600 underline">
            Troubleshooting
          </a>
          <a href="#escalation" className="text-blue-600 underline">
            When to ask for help
          </a>
        </nav>
        <section aria-labelledby="steps">
          <h2 id="steps" className="scroll-mt-8 text-xl font-semibold">
            Step by step
          </h2>
          <ol className="mt-5 list-decimal space-y-5 pl-6 text-sm leading-8 marker:font-semibold marker:text-primary">
            {guide.steps.map((s, i) => (
              <li key={i} className="pl-2">
                {s}
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="troubleshooting" className="mt-9">
          <h2 id="troubleshooting" className="text-xl font-semibold">
            If something goes wrong
          </h2>
          <ul className="mt-4 list-disc space-y-4 pl-6 text-sm leading-7">
            {guide.problems.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
        <section
          aria-labelledby="escalation"
          className="mt-9 rounded-2xl border border-border bg-surface p-5"
        >
          <h2 id="escalation" className="font-semibold">
            When to ask for help
          </h2>
          <p className="mt-3 text-sm leading-7">{guide.escalate}</p>
          <p className="mt-3 text-xs leading-6 text-ink-muted">
            Keep passwords, OTPs, full card details, database URLs and secret
            keys out of support messages.
          </p>
        </section>
        <div className="mt-7 flex flex-wrap gap-4">
          <Link
            href={guide.route}
            className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary"
          >
            Open the relevant area →
          </Link>
          <Link
            href={team ? "/admin/support" : "/business/help"}
            className="rounded-full border border-border px-5 py-3 text-sm font-semibold"
          >
            {team ? "Open support inbox" : "Get human support"}
          </Link>
        </div>
      </article>
      {related.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Related guides</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {related.map((g) => (
              <Link
                key={g.id}
                href={`${base}/${g.id}`}
                className="rounded-xl border border-border bg-paper p-5 text-sm font-semibold text-blue-600 underline"
              >
                {g.title}
              </Link>
            ))}
          </div>
        </section>
      )}
      <p className="text-sm">
        <Link className="text-blue-600 underline" href={base}>
          ← Browse all guides
        </Link>
      </p>
    </div>
  );
}
