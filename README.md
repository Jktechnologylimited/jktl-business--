# JKTL Business

A mobile-first, multi-tenant business platform for Nigerian SMEs. First
vertical: hair salons. Also carries the **AI booking agent & missed-call
revenue recovery** product for men's health, aesthetics and elderly care
clinics.

See **CHECKPOINT.md** for what's built, decisions made along the way, and
what's next. See **[AI-RECEPTIONIST.md](AI-RECEPTIONIST.md)** for the
missed-call pipeline: how a dropped call becomes a booked appointment, the
clinical triage packs for the three health verticals, the free-credit and
communication-wallet model, the pricing, and the go-live runbook.

**Analytics** (`/business/analytics`) is the numbers screen: revenue trend,
invoice ageing, payment mix, no-shows, peak hours, repeat-customer rate, top
services and products, dead stock, monthly profit and loss, and a weighted
business health score that explains which signal is dragging it down. The
engine is pure and unit tested (`src/lib/analytics.ts`, 85 tests).

See **[AFFILIATES.md](AFFILIATES.md)** for the partner programme: the ₦20,000 /
₦40,000 / ₦3,500 tiers, why the signup bonus is held until the referral
subscribes, and how the marketing domain hands over to the business app.

See **[GROWTH.md](GROWTH.md)** for what a revenue target actually requires: the
funnel arithmetic, why cold email cannot carry a two-week target, and the bulk
site-generation job that removes the one bottleneck software could remove.

See **[BILLING.md](BILLING.md)** for everything money-related: automatic monthly
collection of the receptionist subscription (and why a double charge is
impossible), the invoice document and receipts, and the notification and nudge
catalogue.

See **[AFRICA-ROLLOUT.md](AFRICA-ROLLOUT.md)** for the Africa-only targeting
policy: which countries may be emailed and why, how a market is opened,
country-aware phone numbers, and what is still missing (currency, language, SMS
routing, data residency).

See **[LEAD-ENGINE.md](LEAD-ENGINE.md)** for the command centre's lead engine:
importing businesses from Google Maps (Apify/Outscraper), finding the ones with
no website or a poor one, generating each of them a tailored JKTL site, and the
personalised outreach email — plus the compliance notes that go with cold
outreach.

## Tests

```bash
npm test        # node's built-in runner — 402 tests
```

Nine suites: the AI receptionist's pure core (pricing, triage, prompts, SMS),
the Twilio webhook layer (signature verification, missed-call detection, billing
periods), the lead engine's (website audit, provider mappers, site generation,
outreach email), lead enrichment and email validation, the Africa targeting rules
(jurisdictions, phone numbers), the market/currency layer (including the CFA
franc's lack of a subunit), the nudge logic, the analytics engine, and a schema
suite that applies **every migration to a real Postgres**
compiled to WebAssembly (`@electric-sql/pglite`) and then asserts the
guarantees the missed-call pipeline depends on — line uniqueness, webhook
replay safety, and the wallet guardrail. See
[AI-RECEPTIONIST.md](AI-RECEPTIONIST.md#7-what-is-verified-and-what-needs-credentials).

## Two ways to run this

### 1. Demo mode — zero setup

```bash
npm install
npm run dev
```

Open http://localhost:3000, click **"Open salon demo"** on the login page.
Everything runs on mock data held in the browser — no database, no
account, nothing to configure. This never touches the backend below.

### 2. Real accounts — Neon-backed

1. Create a free project at [neon.tech](https://neon.tech).
2. Copy `.env.example` to `.env.local` and paste in your Neon connection
   string (the pooled one from the Neon dashboard).
3. Run the migration:
   ```bash
   npm run db:migrate
   ```
4. `npm run dev`, then use **Sign in** / **Create account** on the login
   page instead of the demo button.

Signing up creates a real row in Postgres (user, organization, business
profile, owner membership, starter billing record) — see
`migrations/001_init.sql` for the schema and `src/lib/db/` for the query
layer (plain parameterized SQL, no ORM).

### "relation … does not exist"

This is the most common first-run failure, and it means the migrations are
behind — not that the app is broken. It happens when a database was set up
before a migration was added, which will also be true of production on every
deploy that adds one.

```bash
npm run db:migrate
```

**Safe to re-run.** Every migration uses `IF NOT EXISTS`, so applying the whole
set again against a populated database adds what is missing and touches nothing
else.

The receptionist console now says this in the UI instead of showing a generic
error — see `isSchemaOutOfDateError` in `src/lib/db/client.ts`, which maps
Postgres `42P01`/`42703`/`42883` to the command that fixes it.

## Offline behavior (real accounts only)

Every mutation — adding a customer, recording a sale, anything — applies
immediately to local state and to IndexedDB, whether or not you're online.
If you're offline, it's queued; a small banner shows how many changes are
waiting. As soon as the connection comes back, the queue drains
automatically against the real backend. See `src/lib/offline/` for the
mechanics and `CHECKPOINT.md` for the specific tradeoffs (e.g. what happens
if a queued change is rejected rather than just delayed).

Demo mode has no queue — there's nothing to sync since it never leaves the
browser.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Zustand · Neon
Postgres (via `@neondatabase/serverless`, no ORM) · IndexedDB for offline

## Regenerating icons

`public/icon-*.png` were generated by `scripts/make-icons.py` from
`scripts/brand/jktl-logo-source.png` (Pillow). Rerun it if the source logo
changes.
