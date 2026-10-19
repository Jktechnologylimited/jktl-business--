# JKTL Lead Engine

Finds local businesses in the three verticals that have **no website or a poor
one**, builds each of them a real JKTL site tailored to their industry, and
emails them a link to it with a subject line carrying both business names.

It lives in the command centre at **`/admin/prospects`**.

---

## The pipeline

Four steps, each triggered by a human, in order:

```
1. Import       Apify / Outscraper / CSV  →  prospects
2. Audit        open each website, score it  →  qualified | rejected
3. Build        generate + publish a JKTL site  →  <name>.jktl.com.ng
4. Send         personalised email, capped  →  prospect_outreach
```

**The review step between 3 and 4 is the point, not an obstacle.** A scraper
pointed at a bulk sender is how a domain gets blacklisted and how you end up
telling a clinic its Facebook page is a bad website. Nothing sends
automatically; the admin looks at each lead, and can preview the exact email
before it goes.

---

## 1. Where the businesses come from

| Source | Env var | Notes |
|---|---|---|
| **Apify** | `APIFY_TOKEN` | Default actor `compass/crawler-google-places`. Override with `APIFY_GOOGLE_MAPS_ACTOR`. |
| **Outscraper** | `OUTSCRAPER_API_KEY` | Usually cheaper per result. |
| **CSV** | — | Paste a spreadsheet. Any headers; `name`, `phone`, `website`, `city`, `email` are recognised. |

Both providers are optional and interchangeable — the mappers
(`src/lib/prospects/providers.ts`) normalize either payload into the same
shape, and both are unit tested against realistic fixtures, so a provider
changing a field name is a failing test rather than a silent import of nothing.

Import is **idempotent**: the provider's place id is the dedupe key, so
re-running "men's health clinic, Yenagoa" next month adds only the businesses
that appeared since. Businesses without a provider id fall back to a
normalised name + city key, so "Bright Smile Dental, Lagos" and
"bright  smile dental, lagos" are one lead.

**Niche inference** maps the provider's category onto one of your verticals —
`mens_health`, `aesthetics`, `elderly_care`, `personal_care` — checking the
specific verticals first so a men's health clinic is never filed as generic
beauty.

---

## 2. What makes a business a lead

`src/lib/prospects/audit.ts`. The audit opens the business's website and scores
it, and — more importantly — decides.

### First, what the `website` column actually contains

A Google Maps listing routinely carries a Facebook page, a Linktree, a
directory entry or a dead domain in its website field. All of those are
classified before any fetch happens:

| What's listed | Verdict | Fetched? |
|---|---|---|
| Nothing | `none` — score 0 | no |
| Facebook, Instagram, Linktree, wa.me | `social_only` | no |
| Yelp, VConnect, a Google Maps link | `social_only` | no |
| `business.site`, `sites.google.com` | `social_only` | no |
| A real domain | audited | yes |
| A phone number in the website column | `none` | no |

The distinction is recorded because the email must not tell someone their
Facebook page is a bad website.

### Then, the judgement

Scored out of 100, weighted for this market specifically — **most visitors
arrive on a phone, from WhatsApp, on mobile data:**

| Fault | Cost | Critical? |
|---|---|---|
| No padlock (HTTP) | −22 | **yes** |
| No mobile layout | −20 | **yes** |
| Nothing to tap to book or message | −9 | **yes** |
| Over 6 MB / 3 MB | −18 / −11 | yes / no |
| Domain parked or expired | −60 | yes |
| Site does not respond | → `unreachable` | yes |
| No WhatsApp/link preview tags | −7 | no |
| No meta description | −8 | no |
| No or weak page title | −12 / −6 | no |
| Over 100 / 50 scripts | −15 / −9 | no / no |
| Slower than 6s / 3s | −18 / −10 | yes / no |
| Google template page | −12 | no |

**Qualification is not the score alone.** A business is a lead if the score is
below 55 **or** any *critical* fault is present. A bare threshold gets this
wrong in both directions: twenty small faults can add up on a perfectly usable
site, and one fatal fault can hide behind a respectable total. The score stays
as an honest health label; `isQualifiedLead()` is the decision. Both are
tested.

An unreachable site is a lead, and the audit never throws — "we could not reach
their website" is itself a reason to call.

---

## 3. The website built for them

`src/lib/prospects/site-builder.ts`. Each qualified lead gets a **real,
published** JKTL site — an ordinary organization with a profile, services and a
public subdomain — because the pitch is the artefact: instead of describing
what a website would look like, the email links to one that already exists with
their name and city on it.

Tailored from the same industry packs the receptionist uses, so a men's health
clinic gets discreet clinical copy and a men's-health service list rather than
a template with "Your Business Name" in the header.

Two rules the generator holds to, both tested:

1. **No invented prices.** Services are seeded at zero and the site renders
   "Ask for price". A made-up figure in a real clinic's name is worse than no
   figure.
2. **No invented facts.** No opening hours, awards, years of experience or
   staff names. What remains is true by construction: their name, their city,
   their category, and their vertical's actual services.

Prospect sites are marked `organizations.is_prospect = true`, and that flag
does three things:

- they stay out of customer counts and revenue reporting;
- the site renders a **"Preview site"** banner naming JKTL, so a visitor who
  stumbles on it is not misled into thinking it is the clinic's live site;
- it is served **`noindex`** — a website we built for a business that has not
  agreed to it must never outrank the website they actually own.

---

## 4. The email

`src/lib/prospects/outreach.ts`. Composition is pure and tested, because the
wording is what makes the claim to a stranger.

**Subject** — always both names, from an editable template
(`outreach_settings.subject_template`, default
`{my_business} built {their_business} a new website`):

> JKTL Business built Vitalis Men's Health a new website

**Body** — states where we found them, links to the site that exists, explains
what it does, and (optionally) lists the audit's own findings, worst first and
at most three. A business with no website is never told its website is faulty;
the opening line says there is none, and `auditHighlights()` deliberately
returns nothing for that case.

Every email carries an **unsubscribe link** whose URL contains only a random
per-prospect token — no email address in a query string, and no way to
unsubscribe a business that isn't yours by guessing a name.

### The guards, all server-side

| Guard | Where | Why |
|---|---|---|
| Admin session required | every action | Platform-level data and spending. |
| **Daily send cap** | checked against the last 24h on every send | Default 40. A lead engine that can send 500 emails a minute is one that burns its sending domain. |
| Suppression | skipped at send time, not just filtered from the list | An opt-out is absolute. |
| Never emailed twice | the candidate query excludes anyone with a sent email | A business hears from us once. |
| No site, no email | send refuses | The email links to the site; without it there is nothing to show. |
| Subject must personalise | settings action rejects a template with no name placeholder | That is the whole claim. |
| Preview before send | `previewOutreachAction` | Nobody sends blind. |

Outreach sends from `RESEND_OUTREACH_FROM_EMAIL` where set, so a sending
reputation that matters for transactional mail is not mixed with prospecting.

### The unsubscribe page

`/unsubscribe?token=…` **requires a click** rather than unsubscribing on page
load. Mail clients and security scanners fetch links in emails before a human
sees them; a GET that suppressed the address would opt out people who never
opened the message.

---

## 4b. Who you are allowed to email

The send path is gated on a country rule — see
**[AFRICA-ROLLOUT.md](AFRICA-ROLLOUT.md)**. In short: Nigeria is permitted,
South Africa/Egypt/Morocco/Kenya/Ghana require recorded consent, the rest of
Africa is unreviewed and will not send, and anything outside Africa is refused
outright. The rules are editable in the workbench, attributed, and stored in the
database rather than in code.

## 5. Before you send anything: compliance

This is cold outreach to businesses, in Nigeria and potentially beyond. The
engineering has the guards above, but two things are yours to decide:

- **Legal basis.** Africa is fifty-four regimes, several stricter than GDPR.
  The per-country rules in [AFRICA-ROLLOUT.md](AFRICA-ROLLOUT.md) encode a
  conservative default and the tool refuses anything unreviewed — but the
  legitimate-interest assessment, the controller registration and the decision
  to open a market are yours.
- **Volume and reputation.** Start well under the cap, send from a dedicated
  subdomain that is properly authenticated (SPF, DKIM, DMARC), and warm it up.
  The cap protects you; it does not make an unauthenticated domain deliverable.

---

## 6. Operating runbook

```bash
npm run db:migrate      # applies migrations/017_free_credits_and_prospecting.sql
```

Set in `.env.local`:

| Variable | For |
|---|---|
| `APIFY_TOKEN` | Apify Google Maps import |
| `APIFY_GOOGLE_MAPS_ACTOR` | Optional actor override |
| `OUTSCRAPER_API_KEY` | Outscraper import |
| `RESEND_API_KEY` | Sending the outreach |
| `RESEND_OUTREACH_FROM_EMAIL` | Optional dedicated sending address |
| `NEXT_PUBLIC_APP_URL` | The base URL in site links and unsubscribe links |

Then, in `/admin/prospects`:

1. **Find businesses** — pick a niche ("men's health clinic"), a place
   ("Yenagoa, Bayelsa"), and import.
2. **Check websites** — run the audit. You get a breakdown of what it found.
3. **Build websites** — five at a time. Each gets a live preview URL.
4. **Email them** — review a row, hit *Preview email*, then send. The batch
   button only touches leads with a built site, an email address and no prior
   email.

The stats strip tracks the funnel: found → qualified → sites built → emailed →
replied → converted. Mark a reply or a conversion on the row so the funnel
means something.

---

## 7. What's verified

`npm test` — 173 tests, all passing: 61 for the receptionist's core, **47 for
the lead engine**, 19 for the Africa targeting rules, and 46 schema tests that
apply every migration to a real Postgres. The lead engine's coverage:

- **Classification**: every kind of thing a Maps listing puts in its website
  column, including non-URLs and bare domains.
- **The audit's judgement**: a healthy site is not a lead; no site is; a
  parked domain doesn't score 100; missing mobile/HTTPS/booking each qualify on
  their own; many small faults qualify through the score; a network failure is
  recorded rather than thrown; markup is measured correctly; and **a page worth
  auditing is never fetched when it isn't a URL**.
- **Provider mappers**: Apify and Outscraper fixtures, comma-decimal ratings,
  closed businesses dropped, blank names skipped, CSV header variants, niche
  inference specificity, and dedupe by place id and by name+city.
- **Generated sites**: subdomains are valid hostnames, copy is tailored, the
  output is deterministic, and **no generated site ever contains a price or an
  invented fact**.
- **The email**: both names in the subject, template fallbacks, unknown
  placeholders stripped, at most three non-trivial findings quoted, no
  invented complaint for a business with no site, and an unsubscribe link
  present in both the HTML and plain-text bodies with no address in the URL.

Three real defects were found by this suite during development:

1. **A parked domain scored 100/100** — the penalty was recorded as a finding
   but never subtracted from the score, so the admin table would have shown a
   dead domain as a perfect website.
2. **`free_exhausted` was computed as `free <= 0 AND free <> 0`**, i.e.
   strictly negative, so a fully-spent free allocation never reported as used
   up. Now `granted > 0 AND free = 0`, computed in a CTE because an alias can't
   be referenced in its own SELECT list.
3. **`inconsistent types deduced for parameter`** in the wallet's credit
   statement — the same placeholder was deduced as two types across the SELECT
   list. Fixed with explicit `::bigint` casts, which is the kind of bug that
   only appears when the SQL is actually executed.

---

## 8. Deliberate limitations

- **No automated follow-up sequence.** One email per business, then it is your
  call. A drip sequence is the obvious next step, but it needs its own
  suppression and cadence rules, not a loop bolted onto this.
- **No reply detection.** Marking a reply or a conversion is manual. IMAP or a
  Resend webhook would close that loop.
- **The audit is a snapshot.** Sites change; a re-audit updates the verdict but
  there is no scheduling. Re-running the audit on demand is enough at this
  volume.
- **Scraping runs synchronously.** An admin waits for the response (up to three
  minutes). Fine for a few times a week; it would need a job queue to run
  unattended.

---

## Getting to 12,000 leads — and the honest maths of emailing them

The request was specific: up to **12,000 businesses** in high-value areas, with
no website or a poor one, not already on JKTL, with custom emails. The first
three are engineering; the fourth is a sending-reputation problem, and it is the
one that decides whether the other three matter.

### Finding 12,000 is a matrix, not one big scrape

One Google Maps search returns at most a few hundred places, and the import runs
inside a single HTTP request, so a 12,000-row scrape would time out long before
it arrived. Scale comes from running **areas × niches** across days:

```
35 curated affluent areas  ×  10 niche queries  =  350 searches
350 searches × ~40 qualified leads             ≈  14,000 leads
```

That is why `src/lib/prospects/areas.ts` exists: the areas are a curated list
rather than free text, which also makes the reporting worth reading — *"Lekki
converted at 4%, Ikeja at 1%"* is a decision; a pile of ad-hoc search strings is
not.

Included: Lekki, Victoria Island, Ikoyi, Banana Island, Ikeja GRA, Surulere, Yaba,
Maitama, Asokoro, Wuse 2, Katampe, Old GRA and New GRA Port Harcourt, Opolo and
Kpansia in Yenagoa; Airport Residential, East Legon, Cantonments, Labone and Osu
in Accra, plus Ahodwo and Nhyiaeso in Kumasi and Airport Ridge in Takoradi;
Cocody, Plateau, Marcory Zone 4, Riviera and Deux Plateaux in Abidjan; Almadies,
Ngor, Plateau, Point E, Mermoz, Ouakam and Saly in Dakar.

Filtering is where the value is, not the volume. `auditWebsite` scores each
business 0–100 and the engine keeps the ones that need help — no site at all, or
a score under 55 — which in practice removes well over half the rows.

### Two changes that made the scale possible

**Batched inserts.** The original wrote one row per round trip. Fine for forty
leads, unusable for twelve thousand — minutes of pure network latency, timing out
long before it finished. `importProspects` now sends the whole array as one
`UNNEST`, 500 rows per statement. A re-scrape is safe: `ON CONFLICT DO NOTHING`
on `(source, source_ref)` means running the same search next month adds only what
appeared since, and never re-audits or re-emails anybody.

**Excluding existing customers.** `excludeExistingCustomers()` runs on every
import, matched on the last nine digits of the phone number — the same identity
the missed-call pipeline uses — with business name and city as a fallback. The
reason is recorded (`prospects.excluded_reason`), so a 12,000-row import is
auditable rather than mysterious. Cold-emailing an existing customer to tell them
their website is poor, when we built it, is the single most damaging thing this
engine could do.

### The part that actually constrains 12,000

**A cold-email domain cannot send 12,000 emails.** It cannot send 500 a day for a
month either. A new sending domain that suddenly emits thousands of identical
messages gets throttled and then blocklisted, and it takes the transactional mail
with it — booking confirmations, receipts, invoice notifications — which is the
mail that must never be blocked.

So the daily cap exists for a reason, and the maths has to be faced:

| Daily cap | 12,000 emails take | Risk |
|---|---|---|
| 40 (current default) | **~300 days** | Low. No warm-up needed. |
| 150 | ~80 days | Moderate — needs 4–6 weeks of warm-up first |
| 500 | ~24 days | High — a separate domain, dedicated IP, and monitoring |

Three honest routes:

1. **Widen the funnel instead of the pipe.** The lead engine's job is not to email
   12,000 people once; it is to email the *best* 40 a day, forever, and to keep
   feeding that queue. 12,000 qualified leads is a year of daily outreach, and
   that is a fine thing to have.
2. **Warm up properly**, over weeks: start at 20/day on the outreach domain, add
   ~10/day per week while watching bounce and complaint rates, and stop climbing
   if bounces exceed 2%. This is the only way to reach hundreds a day, and it
   cannot be skipped.
3. **Add a second channel.** WhatsApp is where these markets actually reply — a
   Nigerian clinic replies to WhatsApp in minutes and to email in weeks. Twilio
   already supports it on the same account, so `sendWhatsApp` is one call away;
   what it needs is an approved template and consent.

Route 1 plus a slow warm-up is the recommendation: the queue is deep enough that
speed is not the constraint, and the transactional mail is worth protecting.

### What is ready now, and what is not

**Ready:** curated areas per market, the niche query matrix, batched import at
scale, existing-customer exclusion, website auditing and scoring, per-area
attribution, consent recording, per-country marketing rules, custom subject lines
that name both businesses, and unsubscribe links on every send.

**Not built, and needing a decision:** the warm-up scheduler (a slow ramp on the
outreach domain), and WhatsApp as a second channel.

---

## Bulk site generation

Generating one site per request does not scale past a handful, so generation is a
job: `startSiteBuildJob` snapshots the work list and `advanceSiteBuildJob` builds a
bounded slice, advanced every five minutes by `/api/cron/build-sites`. Progress
lives in the database, so it is resumable, and the `(job_id, prospect_id)` key
means a restart cannot double-build a business. Photographs are copied onto our own
storage rather than hot-linked.

The reasoning, the throughput, and the funnel arithmetic behind it are in
**[GROWTH.md](GROWTH.md)**.
