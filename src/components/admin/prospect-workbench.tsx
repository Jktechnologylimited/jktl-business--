"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Ban,
  Building2,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  Play,
  Search,
  Send,
  Settings2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { StatTile } from "@/components/app/stat-tile";
import { StatusPill, type Tone } from "@/components/app/status-pill";
import { EmptyState } from "@/components/app/empty-state";
import { formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/lib/toast";
import { BUSINESS_TYPE_OPTIONS } from "@/lib/industry";
import {
  auditLeadsAction,
  clearConsentAction,
  recordConsentAction,
  setCountryRuleAction,
  buildSitesAction,
  importLeadsAction,
  previewOutreachAction,
  saveOutreachSettingsAction,
  sendOutreachAction,
  setProspectStatusAction,
} from "@/lib/actions/prospect-actions";
import type { CountryRuleRow, OutreachSettings, Prospect, ProspectRun, ProspectStats, WebsiteStatus } from "@/lib/prospects/types";
import { decideOutreach } from "@/lib/prospects/jurisdictions";

/**
 * The lead engine workbench.
 *
 * Four buttons, in order, because the pipeline is four decisions: import,
 * audit, build, send. Nothing sends automatically, and nothing is sent to a
 * business the admin hasn't looked at — a bulk email tool pointed at scraped
 * addresses with no review step is how a domain gets burned, and it is also
 * how you end up telling a clinic its Facebook page is a bad website.
 *
 * The table is ordered by lead quality (no site, then broken, then poor), so
 * the best opportunities are the ones you see first.
 */

const WEBSITE_META: Record<WebsiteStatus, { label: string; tone: Tone }> = {
  unaudited: { label: "Not checked", tone: "neutral" },
  none: { label: "No website", tone: "primary" },
  unreachable: { label: "Site down", tone: "danger" },
  social_only: { label: "Social page only", tone: "accent" },
  poor: { label: "Poor website", tone: "danger" },
  ok: { label: "Site OK", tone: "info" },
  good: { label: "Good website", tone: "neutral" },
};

const STATUS_META: Record<Prospect["status"], { label: string; tone: Tone }> = {
  new: { label: "New", tone: "neutral" },
  qualified: { label: "Qualified", tone: "primary" },
  rejected: { label: "Not a lead", tone: "neutral" },
  site_built: { label: "Site built", tone: "accent" },
  contacted: { label: "Emailed", tone: "info" },
  replied: { label: "Replied", tone: "primary" },
  converted: { label: "Customer", tone: "primary" },
  suppressed: { label: "Unsubscribed", tone: "danger" },
};

const RULE_META: Record<CountryRuleRow["rule"], { label: string; tone: Tone; blurb: string }> = {
  permitted: { label: "May email", tone: "primary", blurb: "Opt-out outreach is defensible here." },
  consent_required: { label: "Consent required", tone: "accent", blurb: "Prior, recorded consent is the only lawful route." },
  review_required: { label: "Not reviewed", tone: "neutral", blurb: "No position taken — nothing sends until you decide." },
  blocked: { label: "Blocked", tone: "danger", blurb: "Outside the target region." },
};

export function ProspectWorkbench({
  prospects,
  stats,
  settings,
  runs,
  countries,
  integrations,
}: {
  prospects: Prospect[];
  stats: ProspectStats;
  settings: OutreachSettings;
  runs: ProspectRun[];
  countries: CountryRuleRow[];
  integrations: { apify: boolean; outscraper: boolean; resend: boolean };
}) {
  const router = useRouter();
  const show = useToastStore((s) => s.show);

  const [busy, setBusy] = useState<string>("");
  const [search, setSearch] = useState("");
  const [websiteFilter, setWebsiteFilter] = useState<string>("all");
  const [nicheFilter, setNicheFilter] = useState<string>("all");

  // import form
  const [source, setSource] = useState<"apify" | "outscraper" | "csv">("apify");
  const [query, setQuery] = useState("men's health clinic");
  const [location, setLocation] = useState("");
  /**
   * Which market the search is for.
   *
   * Not cosmetic: it sets the search's region and language, and it decides which
   * marketing rule each lead falls under — Nigeria is `permitted`, Côte d'Ivoire
   * and Senegal are `consent_required`. Leaving it implicit meant every search
   * was pinned to Nigeria, which both biased Google's results towards Lagos and
   * mislabelled Francophone leads as Nigerian.
   */
  const [countryCode, setCountryCode] = useState("NG");
  const [limit, setLimit] = useState("40");
  const [csv, setCsv] = useState("");

  // outreach settings
  const [form, setForm] = useState<OutreachSettings>(settings);
  const [showSettings, setShowSettings] = useState(false);

  // preview drawer
  const [preview, setPreview] = useState<{ businessName: string; subject: string; text: string } | null>(null);

  // country rules + consent
  const [showCountries, setShowCountries] = useState(false);
  const [ruleDraft, setRuleDraft] = useState<Record<string, { rule: CountryRuleRow["rule"]; note: string }>>({});
  const [consentFor, setConsentFor] = useState<string | null>(null);
  const [consentNote, setConsentNote] = useState("");

  const rulesByCode = Object.fromEntries(countries.map((c) => [c.countryCode.toUpperCase(), c.rule])) as Record<string, CountryRuleRow["rule"]>;

  /** What the pipeline will decide for this lead, shown on the row so the send
   * button refusing is never a surprise. */
  function decisionFor(p: Prospect) {
    return decideOutreach({ country: p.country, consentAt: p.consentAt, overrideRule: rulesByCode[(p.country || "").toUpperCase()] });
  }

  const sendableIds = prospects
    .filter((p) => p.status === "site_built" && !p.suppressed && p.email && decisionFor(p).allowed)
    .map((p) => p.id);
  const heldIds = prospects.filter((p) => p.status === "site_built" && !p.suppressed && p.email && !decisionFor(p).allowed);

  async function run<T>(label: string, fn: () => Promise<{ ok: boolean; data?: T; error?: string }>, describe: (data: T) => string) {
    setBusy(label);
    try {
      const result = await fn();
      if (result.ok && result.data !== undefined) {
        show(describe(result.data));
        router.refresh();
      } else {
        show(result.error ?? "Something went wrong.", "danger");
      }
    } finally {
      setBusy("");
    }
  }

  const visible = prospects.filter((p) => {
    if (websiteFilter !== "all" && p.websiteStatus !== websiteFilter) return false;
    if (nicheFilter !== "all" && (p.niche || "general") !== nicheFilter) return false;
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      return p.businessName.toLowerCase().includes(needle) || p.category.toLowerCase().includes(needle) || p.city.toLowerCase().includes(needle);
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Lead engine</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          Find local businesses with no website or a poor one, build them a real JKTL site, and email them a link to it.
        </p>
      </div>

      {!integrations.resend ? (
        <Banner tone="warn">
          <strong className="font-semibold">RESEND_API_KEY is not set</strong>, so no email can be sent. Scraping, auditing and site building all
          still work — imports and previews are unaffected.
        </Banner>
      ) : null}
      {source === "apify" && !integrations.apify ? (
        <Banner tone="warn">
          <strong className="font-semibold">APIFY_TOKEN is not set.</strong> Use Outscraper, or paste a CSV below.
        </Banner>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Businesses found" value={String(stats.total)} sub={`${stats.unaudited} not checked yet`} rule="info" />
        <StatTile label="Qualified leads" value={String(stats.qualified)} sub="No site, or a poor one" rule="primary" />
        <StatTile label="Sites built" value={String(stats.sitesBuilt)} rule="accent" />
        <StatTile
          label="Emailed (last 24h)"
          value={`${stats.sentToday}/${stats.dailyCap}`}
          sub={stats.contacted ? `${stats.contacted} contacted all-time` : "None yet"}
          rule={stats.sentToday >= stats.dailyCap ? "danger" : "info"}
        />
      </div>

      {/* The target region, stated up front. Every send is gated on it. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13px]">
        <span className="flex items-center gap-1.5 font-medium text-ink">
          <Globe className="size-4 text-primary" /> Target region: Africa
        </span>
        <span className="text-ink-muted">
          {countries.filter((c) => c.count > 0).length} countries in this list ·{" "}
          {countries.filter((c) => c.rule === "consent_required" && c.count > 0).length} need recorded consent ·{" "}
          {stats.blockedByCountry} leads held back
        </span>
        <button type="button" onClick={() => setShowCountries((v) => !v)} className="text-primary underline">
          {showCountries ? "Hide rules" : "Review country rules"}
        </button>
      </div>

      {showCountries ? (
        <section className="rounded-2xl border border-border bg-paper p-4">
          <h2 className="font-display text-base font-semibold text-ink">Country rules</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Africa is not one jurisdiction. Where a country requires prior consent, the pipeline will not email it until consent is recorded on
            the lead — and where nothing has been reviewed, nothing sends. Every change is attributed and stamped as reviewed.
          </p>
          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-surface text-[11px] uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-3 py-2 font-semibold">Country</th>
                  <th className="px-3 py-2 font-semibold">Leads</th>
                  <th className="px-3 py-2 font-semibold">Rule</th>
                  <th className="px-3 py-2 font-semibold">Why</th>
                  <th className="px-3 py-2 font-semibold">Reviewed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {countries.map((c) => {
                  const meta = RULE_META[c.rule];
                  const draft = ruleDraft[c.countryCode] ?? { rule: c.rule, note: c.note };
                  return (
                    <tr key={c.countryCode} className={c.count > 0 ? "" : "opacity-60"}>
                      <td className="px-3 py-2 text-ink">
                        {c.countryName} <span className="text-ink-faint">+{c.dialCode}</span>
                      </td>
                      <td className="px-3 py-2 text-ink-muted">{c.count || "—"}</td>
                      <td className="px-3 py-2">
                        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                      </td>
                      <td className="max-w-[260px] px-3 py-2 text-xs text-ink-muted" title={c.note}>
                        <Input
                          value={draft.note}
                          onChange={(e) => setRuleDraft({ ...ruleDraft, [c.countryCode]: { ...draft, note: e.target.value } })}
                          className="h-9 text-xs"
                          aria-label={`Rule note for ${c.countryName}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Select
                            value={draft.rule}
                            onChange={(e) =>
                              setRuleDraft({ ...ruleDraft, [c.countryCode]: { ...draft, rule: e.target.value as CountryRuleRow["rule"] } })
                            }
                            className="h-9 max-w-[150px] text-xs"
                            aria-label={`Rule for ${c.countryName}`}
                          >
                            {(Object.keys(RULE_META) as CountryRuleRow["rule"][]).map((r) => (
                              <option key={r} value={r}>
                                {RULE_META[r].label}
                              </option>
                            ))}
                          </Select>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={Boolean(busy)}
                            onClick={() =>
                              run(
                                `rule-${c.countryCode}`,
                                () => setCountryRuleAction(c.countryCode, draft.rule, draft.note),
                                () => `${c.countryName} set to "${RULE_META[draft.rule].label}".`,
                              )
                            }
                          >
                            Save
                          </Button>
                        </div>
                        {c.reviewedAt ? <span className="text-[11px] text-primary-strong">Reviewed</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            These defaults are engineering, not legal advice. Confirm each market with counsel before opening it, and record what you relied on
            in the note.
          </p>
        </section>
      ) : null}

      {/* ---- 1. Import ---- */}
      <section className="rounded-2xl border border-border bg-paper p-4">
        <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-ink">
          <Search className="size-4 text-primary" /> 1. Find businesses
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Pull Google Maps listings for a niche and a place. Re-running the same search only adds businesses that are new.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <Field label="Source" htmlFor="source">
            <Select id="source" value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
              <option value="apify">Apify (Google Maps)</option>
              <option value="outscraper">Outscraper</option>
              <option value="csv">CSV / spreadsheet</option>
            </Select>
          </Field>
          <Field label="Niche" htmlFor="query">
            <Input id="query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="men's health clinic" />
          </Field>
          <Field label="Market" htmlFor="market">
            <Select id="market" value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
              <option value="NG">Nigeria (NGN)</option>
              <option value="GH">Ghana (GHS)</option>
              <option value="CI">Côte d&apos;Ivoire (XOF)</option>
              <option value="SN">Senegal (XOF)</option>
            </Select>
          </Field>
          <Field label="Where" htmlFor="location">
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={countryCode === "NG" ? "Lekki Phase 1, Lagos" : countryCode === "GH" ? "East Legon, Accra" : countryCode === "CI" ? "Cocody, Abidjan" : "Almadies, Dakar"}
            />
          </Field>
          <Field label="Max results" htmlFor="limit">
            <Input id="limit" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value)} />
          </Field>
        </div>

        {source === "csv" ? (
          <div className="mt-3">
            <Field label="Paste CSV" htmlFor="csv" hint="Needs at least a business name column. Headers like name, phone, website, city, email are recognised.">
              <Textarea id="csv" rows={4} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="name,category,phone,website,city,email" />
            </Field>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={Boolean(busy)}
            onClick={() =>
              run(
                "import",
                () => importLeadsAction({ source, query, location, limit: Number(limit) || 40, csv, countryCode }),
                (data: { detail: string }) => data.detail,
              )
            }
          >
            {busy === "import" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Import leads
          </Button>
          <span className="text-xs text-ink-muted">
            {integrations.apify ? "Apify token configured." : "No Apify token."} {integrations.outscraper ? "Outscraper key configured." : "No Outscraper key."}
          </span>
        </div>

        {runs.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-surface text-[11px] uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-3 py-2 font-semibold">Search</th>
                  <th className="px-3 py-2 font-semibold">Source</th>
                  <th className="px-3 py-2 text-right font-semibold">Found</th>
                  <th className="px-3 py-2 text-right font-semibold">New</th>
                  <th className="px-3 py-2 text-right font-semibold">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 text-ink">
                      {r.query}
                      {r.location ? <span className="text-ink-muted"> · {r.location}</span> : null}
                      {r.status === "failed" ? <span className="block text-xs text-danger">{r.error}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-ink-muted">{r.source}</td>
                    <td className="px-3 py-2 text-right">{r.found}</td>
                    <td className="px-3 py-2 text-right font-medium">{r.imported}</td>
                    <td className="px-3 py-2 text-right text-ink-muted">{formatRelativeDay(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* ---- 2 & 3. Audit and build ---- */}
      <section className="rounded-2xl border border-border bg-paper p-4">
        <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-ink">
          <Wand2 className="size-4 text-primary" /> 2. Check their websites, then build theirs
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          The audit opens each business&apos;s site and scores it on what actually matters here: mobile layout, security, speed, and whether a
          visitor can book or call. Below 55 is a lead.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={Boolean(busy) || stats.unaudited === 0}
            onClick={() =>
              run(
                "audit",
                () => auditLeadsAction(25),
                (data: { audited: number; qualified: number; rejected: number }) =>
                  `Checked ${data.audited}: ${data.qualified} qualified, ${data.rejected} already have a good site.`,
              )
            }
          >
            {busy === "audit" ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />} Check {Math.min(25, stats.unaudited)} websites
          </Button>
          <Button
            size="sm"
            disabled={Boolean(busy) || stats.qualified === 0}
            onClick={() =>
              run(
                "build",
                () => buildSitesAction(5),
                (data: { built: number }) => (data.built ? `${data.built} website${data.built === 1 ? "" : "s"} built and published.` : "Nothing to build."),
              )
            }
          >
            {busy === "build" ? <Loader2 className="size-4 animate-spin" /> : <Building2 className="size-4" />} Build 5 websites
          </Button>
        </div>
      </section>

      {/* ---- 4. Outreach ---- */}
      <section className="rounded-2xl border border-border bg-paper p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-ink">
              <Mail className="size-4 text-primary" /> 3. Email them
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Each email names the business and us in the subject, links to the site already built for them, and lists what the audit found.
              Capped at {settings.dailySendCap} a day.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setShowSettings((v) => !v)}>
            <Settings2 className="size-4" /> Sender & subject
          </Button>
        </div>

        {showSettings ? (
          <div className="mt-3 rounded-xl border border-border bg-surface p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Your business name (used in the subject)" htmlFor="sender">
                <Input id="sender" value={form.senderBusinessName} onChange={(e) => setForm({ ...form, senderBusinessName: e.target.value })} />
              </Field>
              <Field
                label="Subject template"
                htmlFor="subject"
                hint="{their_business} and {my_business} are replaced. At least one is required."
              >
                <Input id="subject" value={form.subjectTemplate} onChange={(e) => setForm({ ...form, subjectTemplate: e.target.value })} />
              </Field>
              <Field label="From address" htmlFor="from" hint="Leave empty to use the platform default.">
                <Input id="from" value={form.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} placeholder="hello@jktl.com.ng" />
              </Field>
              <Field label="Reply-to" htmlFor="reply" hint="Where a prospect's reply lands.">
                <Input id="reply" value={form.replyTo} onChange={(e) => setForm({ ...form, replyTo: e.target.value })} placeholder="you@jktl.com.ng" />
              </Field>
              <Field label="Daily send cap" htmlFor="cap" hint="Protects the sending domain. 20–50 is sensible for cold outreach.">
                <Input id="cap" inputMode="numeric" value={String(form.dailySendCap)} onChange={(e) => setForm({ ...form, dailySendCap: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
              </Field>
              <Field label="Calendar link (optional)" htmlFor="cal" hint="Shown as an alternative to replying.">
                <Input id="cal" value={form.calendarLink} onChange={(e) => setForm({ ...form, calendarLink: e.target.value })} />
              </Field>
            </div>
            <label className="mt-3 flex items-start gap-2 text-[13px] text-ink">
              <input
                type="checkbox"
                checked={form.includeAudit}
                onChange={(e) => setForm({ ...form, includeAudit: e.target.checked })}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                Include what the audit found about their current website
                <span className="block text-xs text-ink-muted">Leave this on: a specific observation is what makes the email credible. Turn it off for businesses with no site at all.</span>
              </span>
            </label>
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                disabled={Boolean(busy)}
                onClick={() =>
                  run(
                    "settings",
                    () => saveOutreachSettingsAction(form),
                    () => "Outreach settings saved.",
                  )
                }
              >
                Save
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={Boolean(busy) || sendableIds.length === 0}
            onClick={() =>
              run(
                "send",
                () => sendOutreachAction(sendableIds, 10),
                (data: { sent: number; failed: number; cappedOut: boolean }) =>
                  data.cappedOut
                    ? `Sent ${data.sent}. Daily cap reached — stopped here.`
                    : `Sent ${data.sent}${data.failed ? `, ${data.failed} failed` : ""}.`,
              )
            }
          >
            {busy === "send" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Email {sendableIds.length} ready lead
            {sendableIds.length === 1 ? "" : "s"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowCountries((v) => !v)}>
            <Globe className="size-4" /> Countries
          </Button>
          <span className="text-xs text-ink-muted">
            {sendableIds.length === 0
              ? heldIds.length > 0
                ? `${heldIds.length} lead${heldIds.length === 1 ? "" : "s"} held back by the country rules below.`
                : "Build a site first — emails link to it."
              : `Ready to send. ${heldIds.length > 0 ? `${heldIds.length} more held back by country rules.` : ""}`}
          </span>
        </div>
      </section>

      {/* ---- The leads ---- */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, category or city" aria-label="Search leads" />
          </div>
          <Select value={websiteFilter} onChange={(e) => setWebsiteFilter(e.target.value)} className="max-w-[190px]" aria-label="Filter by website">
            <option value="all">All websites</option>
            {(Object.keys(WEBSITE_META) as WebsiteStatus[]).map((s) => (
              <option key={s} value={s}>
                {WEBSITE_META[s].label}
              </option>
            ))}
          </Select>
          <Select value={nicheFilter} onChange={(e) => setNicheFilter(e.target.value)} className="max-w-[200px]" aria-label="Filter by niche">
            <option value="all">All niches</option>
            <option value="general">Other / general</option>
            {BUSINESS_TYPE_OPTIONS.filter((o) => ["mens_health", "aesthetics", "elderly_care", "personal_care"].includes(o.id)).map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={<Search className="size-5" />}
            title="No leads yet"
            description="Import businesses from Google Maps above, then run the website check to see which ones need a site."
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {visible.map((p) => {
              const website = WEBSITE_META[p.websiteStatus];
              const status = STATUS_META[p.status];
              return (
                <div key={p.id} className="rounded-2xl border border-border bg-paper p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink">{p.businessName}</span>
                        <StatusPill tone={website.tone}>{website.label}</StatusPill>
                        {p.websiteScore !== null ? (
                          <span className={cn("text-xs font-semibold", p.websiteScore < 55 ? "text-danger" : "text-ink-muted")}>
                            {p.websiteScore}/100
                          </span>
                        ) : null}
                        <StatusPill tone={status.tone}>{status.label}</StatusPill>
                      </div>
                      <div className="mt-0.5 text-xs text-ink-muted">
                        {[p.category, p.city || p.state].filter(Boolean).join(" · ")}
                        {p.rating ? ` · ${p.rating}★ (${p.reviews ?? 0})` : ""}
                        {p.email ? ` · ${p.email}` : " · no email"}
                        {p.phone ? ` · ${p.phone}` : ""}
                      </div>
                      {(() => {
                        const decision = decisionFor(p);
                        const rule = RULE_META[decision.rule];
                        return (
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <StatusPill tone={rule.tone}>{`${p.country || "??"} · ${rule.label}`}</StatusPill>
                            {p.consentAt ? (
                              <span className="text-[11px] text-primary-strong">
                                Consent {formatRelativeDay(p.consentAt)}
                                {p.consentNote ? ` — ${p.consentNote}` : ""}
                              </span>
                            ) : null}
                            {!decision.allowed ? <span className="text-[11px] text-danger">{p.blockedReason || decision.reason}</span> : null}
                          </div>
                        );
                      })()}
                      {p.auditFindings.length > 0 ? (
                        <ul className="mt-1.5 flex flex-col gap-0.5">
                          {p.auditFindings.slice(0, 3).map((f) => (
                            <li key={f.code} className="text-xs text-ink-muted">
                              • {f.label}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {p.siteSubdomain ? (
                        <a
                          href={`/sites/${p.siteSubdomain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-border-strong px-2.5 py-1.5 text-xs font-medium text-ink hover:border-primary hover:text-primary"
                        >
                          <ExternalLink className="size-3.5" /> Their site
                        </a>
                      ) : null}
                      {p.website ? (
                        <a
                          href={p.website.startsWith("http") ? p.website : `https://${p.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-ink-muted underline hover:text-ink"
                        >
                          current site
                        </a>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          run(
                            `preview-${p.id}`,
                            () => previewOutreachAction(p.id),
                            (data: { subject: string; text: string }) => {
                              setPreview({ businessName: p.businessName, subject: data.subject, text: data.text });
                              return "Preview ready below.";
                            },
                          )
                        }
                      >
                        Preview email
                      </Button>
                      {decideOutreach({ country: p.country, consentAt: p.consentAt, overrideRule: rulesByCode[(p.country || "").toUpperCase()] })
                        .requiresConsent && !p.consentAt ? (
                        <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => setConsentFor(p.id)}>
                          <CheckCircle2 className="size-3.5" /> Record consent
                        </Button>
                      ) : null}
                      {p.consentAt ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={Boolean(busy)}
                          onClick={() =>
                            run(
                              `consent-off-${p.id}`,
                              () => clearConsentAction(p.id),
                              () => `Consent withdrawn for ${p.businessName}.`,
                            )
                          }
                          title="Withdraw recorded consent"
                        >
                          <Ban className="size-3.5" />
                        </Button>
                      ) : null}
                      {p.status !== "converted" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={Boolean(busy)}
                          onClick={() =>
                            run(
                              `convert-${p.id}`,
                              () => setProspectStatusAction(p.id, "converted"),
                              () => `${p.businessName} marked as a customer.`,
                            )
                          }
                        >
                          <CheckCircle2 className="size-3.5" /> Converted
                        </Button>
                      ) : null}
                      {p.status !== "rejected" && p.status !== "converted" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={Boolean(busy)}
                          onClick={() =>
                            run(
                              `reject-${p.id}`,
                              () => setProspectStatusAction(p.id, "rejected"),
                              () => `${p.businessName} set aside.`,
                            )
                          }
                          title="Not a lead"
                        >
                          <Ban className="size-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {consentFor ? (
        <section className="rounded-2xl border border-accent/40 bg-accent-soft p-4">
          <h2 className="font-display text-base font-semibold text-ink">How did they agree to be contacted?</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            This country requires prior consent, so this note is the evidence. Be specific — &quot;replied to our WhatsApp asking us to
            rebuild their site on 3 March&quot; stands up; &quot;they seemed interested&quot; does not.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              value={consentNote}
              onChange={(e) => setConsentNote(e.target.value)}
              placeholder="How and when they agreed"
              className="h-10"
              aria-label="Consent note"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-10"
                disabled={Boolean(busy) || consentNote.trim().length < 8}
                onClick={() =>
                  run(
                    "consent",
                    () => recordConsentAction(consentFor, consentNote),
                    () => {
                      setConsentFor(null);
                      setConsentNote("");
                      return "Consent recorded.";
                    },
                  )
                }
              >
                Record consent
              </Button>
              <Button size="sm" variant="ghost" className="h-10" onClick={() => setConsentFor(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {preview ? (
        <section className="rounded-2xl border border-primary/30 bg-primary-soft p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-ink">Preview for {preview.businessName}</h2>
              <p className="mt-0.5 text-xs text-ink-muted">Exactly what they would receive. Nothing has been sent.</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>
              Close
            </Button>
          </div>
          <div className="mt-3 rounded-xl border border-border bg-paper p-3">
            <div className="text-[13px] font-semibold text-ink">Subject: {preview.subject}</div>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] text-ink">{preview.text}</pre>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Banner({ tone, children }: { tone: "warn" | "info"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] text-ink",
        tone === "warn" ? "border-accent/40 bg-accent-soft" : "border-border bg-surface",
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent-strong" />
      <div>{children}</div>
    </div>
  );
}
