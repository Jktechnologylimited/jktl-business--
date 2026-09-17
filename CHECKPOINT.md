# JKTL Business — Checkpoint 5 (Phase 2: Neon backend + offline sync)

This is the first Phase 2 pass: a real Postgres backend on Neon, real
authentication, and genuine offline-first sync. Phase 1's demo experience
("Open salon demo") is untouched and still runs entirely on mock data.

## Architecture, in one paragraph

Every screen already funneled its mutations through one Zustand store
(`addCustomer`, `addSale`, etc.), so instead of rewriting any page, those
same store actions were extended: they still apply the change to local
state immediately (same optimistic UI as before), and — only in "live"
mode — also write the change to IndexedDB and drop a job in a local
outbox. A sync engine drains that outbox against the real backend
(Next.js Server Actions, which call a plain-SQL data-access layer) whenever
the browser is online, and picks back up automatically on reconnect. Demo
mode never touches any of this.

## What's built

- **Schema** (`migrations/001_init.sql`) — all the tables from the original
  brief's Section 17 list that the app actually uses (skipped `suppliers`,
  `notifications`, `files`, `payments` as separate tables since nothing in
  the UI needs them as their own entities yet — `supplier` stays a text
  field on `products`, matching the existing frontend). UUID keys, BIGINT
  kobo, foreign keys with `ON DELETE CASCADE`/`SET NULL` as appropriate,
  indexes on every `organization_id`.
- **Migration runner** (`scripts/migrate.mjs`) — `npm run db:migrate`. No
  framework, just applies `migrations/*.sql` in order.
- **Data-access layer** (`src/lib/db/*.ts`) — one file per entity, plain
  parameterized SQL via `@neondatabase/serverless`'s tagged-template `sql`
  function. Every function takes `organizationId` as an explicit first
  argument; nothing infers tenancy from anything the client sends.
- **Auth** (`src/lib/db/auth.ts`, `src/lib/session.ts`) — bcrypt (via
  `bcryptjs`, pure JS, no native build step), DB-backed sessions (a
  `sessions` table, not JWTs), httpOnly cookie. Signup creates the user,
  organization, business profile, owner membership, and starter billing
  record in one atomic statement (a data-modifying CTE).
- **Server Actions** (`src/lib/actions/*.ts`) — the only way the client
  reaches the database. Every mutating action calls `requireSession()`
  first and gets `organizationId` from the server-side session — never
  from anything the client passed in, per the brief's Section 18.
- **Offline engine** (`src/lib/offline/`):
  - `idb.ts` — a small IndexedDB wrapper: one cached tenant snapshot per
    org (not a per-record store — simpler, and sufficient since the
    in-memory Zustand store already handles real querying; IndexedDB here
    is purely for durability across reloads/offline).
  - `mutation-registry.ts` — maps every mutation type to the Server Action
    that applies it.
  - `sync.ts` — drains the outbox in order. A thrown error (couldn't reach
    the server) stops the loop so ordering is preserved and it retries
    later. A resolved-but-rejected result (server reached, rejected the
    operation) is logged, dropped, and surfaced once via toast — retrying
    a rejected mutation forever wouldn't fix it.
- **The store** (`src/lib/store.ts`) — now has a `mode: "demo" | "live"`
  flag. Every create action generates a real `crypto.randomUUID()` in live
  mode (short mock ids in demo mode) so an offline-created record keeps
  the same id all the way through sync — important when, say, a sale
  created offline references a customer also created offline.
- **UI**: the offline banner in the app shell now has three states —
  offline (shows a pending-change count once there's anything queued),
  syncing (visible whenever online with a non-empty outbox), or nothing.

## The two hardest correctness problems, and how they were handled

1. **Dependent offline creates.** If you're offline, add a new customer,
   then record a sale for that customer, the sale's `customer_id` has to
   resolve once both sync. Solved by generating the id client-side
   (`crypto.randomUUID()`) at creation time instead of letting Postgres
   assign it — the local record and the eventual server row share an id
   from the start, so there's nothing to reconcile.
2. **Retry safety.** A flaky connection can make a request that actually
   succeeded look like it failed, causing the sync engine to retry it.
   Every create is an `INSERT ... ON CONFLICT (id) DO UPDATE`, making
   retries idempotent. Sale creation specifically also had to guard against
   double-deducting stock on a retried create — it checks Postgres's
   `xmax` system column to tell "genuinely new row" from "hit the conflict
   branch," and only runs the stock deduction on the former.

## Known limitations (real ones, not hedging)

- **Not tested against a live database.** This sandbox has no network
  route to Neon (or anywhere outside a short allowlist), so everything
  here is verified by `tsc`, `eslint`, and a full `npm run build` — not by
  actually running a signup and watching a row appear in Postgres. That's
  the first thing to do before trusting this.
- **Sale creation is atomic for "sale + its line items," not for "sale
  and its stock deduction."** Those are two separate statements. A
  single-statement CTE handles the first; the second (decrementing
  product stock + logging the movement) is a second round trip. A failure
  between the two is a real, if narrow, gap. Closing it fully means
  switching from the HTTP-based `neon()` client to
  `@neondatabase/serverless`'s WebSocket `Pool` with a real
  `BEGIN`/`COMMIT` — deliberately not done here to avoid adding WebSocket
  connection lifecycle management for one operation.
- **Invoice numbers are computed client-side** from the local invoice
  count (`INV-000N`), same as the old mock layer. Two devices creating
  invoices offline at the same time, for the same business, could compute
  the same number — the database's `UNIQUE(organization_id, number)`
  constraint would then reject the second one at sync time, and the sync
  engine would drop it with a toast rather than renumber and retry. Narrow
  edge case (needs simultaneous multi-device offline use), not fully
  solved.
- **Pull-refresh only happens when the outbox is empty.** If the server
  were pulled while local changes are still queued, it would overwrite
  those optimistic local changes on screen (not lost — still queued and
  will still sync — but would visually vanish until they did). Rather than
  build real merge logic, a full server pull is simply skipped whenever
  anything is still pending.
- **Resuming onboarding after a reload isn't fully handled.** The signup
  password/email are held in memory only (`pendingSignup`, not persisted)
  until the account is actually created at the business-type step. If
  someone reloads mid-onboarding *before* reaching that step, they'd need
  to start over. After that point, the real account exists and reloading
  is fine.
- **No email, no file storage.** Resend and the `files` table from the
  original brief aren't part of this pass at all — avatar photos still
  live as base64 in the `users.avatar_url` column, and forgot-password is
  still a mock UI with no real email sent.
- **Business profile editing** in Settings is still read-only in the UI,
  even though the backend (`updateBusinessProfileAction`) exists —
  onboarding is the only place that currently writes to it.

## Next steps

1. Actually test it: create a Neon project, run the migration, sign up,
   and confirm data lands correctly — including the offline path (DevTools
   → Network → Offline, make some changes, go back online, watch the
   banner and confirm the rows appear in Neon's SQL editor).
2. If the atomicity gap in sale creation matters in practice, upgrade that
   one function to the WebSocket `Pool` with a real transaction.
3. Wire Resend for the emails the original brief lists (welcome, invoice,
   booking confirmation, renewal reminders) — untouched so far.
4. Make the Business tab in Settings editable, calling the
   `updateBusinessProfileAction` that already exists.

---

## Update: Neon connectivity tested + Resend wired

**Neon:** attempted a real connection using a live connection string. Result:
this sandbox cannot reach Neon at all — confirmed precisely (`x-deny-reason:
host_not_allowed` on HTTPS; raw TCP on 5432 times out). Nothing about the
code was validated against a real database as a result; this remains the
first thing to do locally: `npm run db:migrate`, then sign up.

**Resend:** wired for real, not stubbed —
- Welcome email on signup (awaited, not fire-and-forget, since an
  un-awaited promise in a serverless function can be cut off before it
  finishes — errors are swallowed so a slow/failed email never fails
  signup itself).
- Booking confirmation, sent whenever a booking's saved status is
  `confirmed` (on create, full edit, or status-only update). Known rough
  edge: editing an already-confirmed booking's notes re-sends the
  confirmation email, since there's no "did status actually change" check.
  Narrow annoyance, not a correctness bug.
- Payment confirmation, sent automatically when an invoice is marked paid.
- Invoice email, sent only on an explicit "Email invoice" button on the
  invoice detail page (live mode only) — not automatic on create, since
  drafts shouldn't go out uninvited.
- Renewal reminder template exists (`sendRenewalReminderEmail` in
  `src/lib/email.ts`) but nothing calls it yet — it needs a scheduled
  trigger (e.g. Vercel Cron hitting a new Route Handler), which isn't part
  of this app's runtime and wasn't built.
- All four wired sends degrade the same way without a customer email on
  file or without `RESEND_API_KEY` set: logged, skipped, never blocks the
  action that triggered them.

Also not done: real password-reset (forgot-password is still a mock UI —
no reset-token table, no real email, no reset page wired to change a real
password_hash).
