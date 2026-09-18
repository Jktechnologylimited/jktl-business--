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

---

## Update: real password reset, password visibility, editable business
## profile, partial payments + receipt photos on sales

Also fixed two real bugs found by live testing in between: a cross-account
data leak on signup (`startSignup` was spreading stale in-memory state
instead of a fresh tenant) and a `jsonb_to_recordset` camelCase/snake_case
mismatch that made every sale (and invoice) fail to save and silently lose
data on refresh. Both are fixed as of this checkpoint — see the git-free
history in this doc's earlier revisions for the full diagnosis if it
resurfaces.

**Migration** (`migrations/002_payments_and_reset.sql`, idempotent, applies
after `001_init.sql`):
- `password_reset_tokens` table — only a SHA-256 hash of the raw token is
  ever stored, same principle as `password_hash`. 1-hour expiry.
- `sales.amount_paid_kobo` (BIGINT, default 0) and `sales.receipt_photo_url`
  (nullable TEXT). Existing `paid` rows are backfilled to
  `amount_paid_kobo = total_kobo` so old data stays consistent.

**Real password reset** (`src/lib/db/auth.ts`, `src/lib/actions/auth-actions.ts`):
- `requestPasswordResetAction(email)` — looks up the user, and if found,
  creates a token and emails a real reset link via Resend
  (`sendPasswordResetEmail` in `src/lib/email.ts`). Always returns
  `ok: true` regardless of whether the email matched an account, so the
  forgot-password page can't be used to enumerate registered emails — the
  email itself is the real signal back to the account owner.
- `/reset-password?token=...` (new page) — sets a new password, then
  invalidates every other outstanding reset token for that account.
- Bonus, same infrastructure: the previously-mock "Change password" form
  in Settings → Account now calls a real `changePasswordAction` (verifies
  the current password first). Demo mode keeps the old mock behavior since
  there's no real account to change.

**Password visibility toggle** — new `src/components/ui/password-input.tsx`
(an `Input` with an eye/eye-off button). Used on login, signup, the new
reset-password page, and both password fields in Settings.

**Editable business profile** — Settings → Business now has a real "Edit"
sheet (`src/components/settings/business-form.tsx`) wired to the
`updateBusinessProfileAction`/`updateBusinessProfile` DB function that
already existed from Phase 2 but had no caller. Goes through the same
optimistic + outbox path as every other entity (new store method
`updateBusinessProfile`, reusing the existing `business.updateProfile`
mutation-registry entry).

**Partial payments on sales**:
- `Sale` gained `amountPaidKobo` and `receiptPhotoUrl`.
- The sale form shows an "Amount paid now" field when payment status is
  set to "Partial", with the balance shown live.
- New sale detail page (`/business/sales/[id]`, sales list rows now link
  to it, mirroring the existing invoice detail page) shows the full
  breakdown — total, paid, balance — and an "Update payment" action
  (`src/components/sales/update-payment-form.tsx`) that lets you record
  more of the balance later; payment status is derived automatically from
  the new amount (0 paid → pending, full → paid, in between → partial).
  Backed by a new `updateSalePaymentAction`/`updateSalePayment` DB function
  and a new `sale.updatePayment` offline-sync entry — this queues and
  retries like every other mutation if it's recorded offline.

**Receipt photos (optional)** — a new `ReceiptPhotoField` component (used
in both the sale form and the payment-update sheet) lets a photo of the
physical receipt be attached, stored as a compressed JPEG data URL (via a
new non-cropping `fileToDataUrl` in `src/lib/image.ts` — receipts are
documents, so unlike the avatar uploader this doesn't force a square crop).
Shown on the sale detail page when present.

### Known limitations of this round

- Receipt photos and avatars both still travel as base64 data URLs stored
  directly in Postgres columns, not as files in real object storage —
  fine for a handful of photos per business, but will bloat row sizes and
  `pg_dump`s if usage grows. Moving to actual blob storage (S3-compatible,
  or Vercel Blob) is a clean follow-up whenever that starts to matter.
- The reset-link origin is derived from the incoming request's `Host`
  header (via `next/headers`) rather than a fixed `NEXT_PUBLIC_APP_URL` —
  works correctly on Vercel and locally, but if this ever sits behind a
  proxy that doesn't forward `Host` faithfully, the emailed link could
  point at the wrong origin. Worth switching to an explicit env var if
  that ever happens.
- As with every other Phase 2 feature, none of this has been exercised
  against a live Neon database from inside the tool that built it — this
  sandbox still has no network route to `*.neon.tech`. Verified here via
  `tsc --noEmit`, `eslint`, and a full `next build`; real-world testing
  (via `npm run db:migrate` picking up `002_payments_and_reset.sql`,
  requesting a real reset email, recording a partial sale and later
  completing it, attaching a receipt photo) still needs to happen against
  the real deployment.

## Next steps

1. Run `npm run db:migrate` against the real database to pick up
   `002_payments_and_reset.sql`, then test each new flow end-to-end:
   forgot-password → email → reset link → new password → sign in; a
   partial sale → later "Update payment" → marked paid; a receipt photo
   attached and visible after a refresh.
2. Consider real blob storage for avatar/receipt photos if usage grows.
3. Renewal-reminder email automation still has no scheduled trigger.
4. The sale-creation atomicity gap (line items are atomic with the sale;
   stock deduction is a second statement) is unchanged from before.

---

## Update: in-app Help & guides

A self-serve help screen — no backend involved, pure frontend, works the
same in demo and live mode.

- **`/business/help`** (new page) — a searchable, filterable list of
  question-and-answer "bubbles": tap a question to expand its answer,
  styled as a small chat exchange. Content lives in one place,
  `src/lib/guides.ts` (`GUIDES` array + `GUIDE_CATEGORIES`), so adding or
  editing a guide is a data change, not a UI change. Covers every module
  built so far — customers, bookings, sales (including the new partial-
  payment and receipt-photo flows), invoices, products/inventory,
  expenses, reports, team/account (including the new password reset and
  editable business profile), and how offline sync works.
- **"How do I add JKTL Business to my home screen?"** is one of those
  questions, but its answer is a small custom component
  (`src/components/help/add-to-home-screen-guide.tsx`) instead of plain
  text: it guesses the visitor's platform (iPhone/iPad, Android, or
  desktop) from the user agent and shows the right numbered steps, with
  tabs to switch manually if the guess is wrong. It only ever renders
  after the person taps to expand it, so there's no server/client
  mismatch risk from reading `navigator` — nothing platform-specific is
  in the initial page load.
- Reachable three ways: a "Help & guides" entry in the More tab (added to
  `industry.nav.more` in `src/lib/industry.ts`, so every business type
  gets it automatically), and in both the desktop and mobile avatar-menu
  dropdowns in `src/components/app/shell.tsx`, next to Settings.

### Known limitation

Guide content is static and in English only, written from what's actually
built as of this checkpoint — it'll drift out of date the next time a
flow changes unless `src/lib/guides.ts` is updated alongside it.

---

## Update: polish & hardening pass

Three backlog items closed, none of them behavior-visible unless you look
for them — the app should look and act identical, just sturdier under the
hood. All opt-in via env vars, so nothing here requires any setup to keep
working exactly as before.

**1. Sale creation is now genuinely atomic, in one round trip.**
`createSale` (`src/lib/db/sales.ts`) used to be two separate statements —
sale + line items atomic via one CTE, then stock deduction and the
inventory-movement log as a second, separate statement. A crash or timeout
between the two could, in theory, leave a sale recorded with stock never
deducted. Folded the stock deduction into the *same* CTE instead (gated by
the existing `(xmax = 0)` freshly-inserted check, now evaluated in SQL
rather than branching in JS) — it's one Postgres statement, so it's now
all-or-nothing. Picked up a real secondary bug for free while in there: the
old code used a plain `UPDATE ... FROM` join for stock, which silently
applies only *one* matching row when two line items reference the same
product — so a sale with the same product on two separate lines was only
deducting one of them. Fixed by pre-summing quantities per product
(`product_totals` CTE) before the stock update.

**2. Avatar and receipt photos now use real file storage, when configured.**
Both were base64 data URLs stored directly in Postgres text columns — fine
at small scale, but it bloats row size and `pg_dump`s as usage grows. Added
`src/lib/blob.ts` (`persistImage` / `deleteImageIfBlob`) using Vercel Blob:
`setAvatarAction` and the sale actions now upload any data URL they receive
to Blob storage and store just the resulting URL, deleting the previous
blob (best-effort) when a photo is replaced or removed. **Fully backward
compatible and zero-setup by default** — without `BLOB_READ_WRITE_TOKEN`
set, `persistImage` returns the data URL unchanged and everything works
exactly as it did before this existed. Set that one env var (create a Blob
store under your Vercel project's Storage tab) whenever you want to
upgrade; nothing needs migrating, since old inline photos keep working
and only new uploads go to Blob storage.

**3. Renewal-reminder emails are wired up.** The email template
(`sendRenewalReminderEmail`) existed since the Resend pass but nothing
ever called it. Added:
- `listUpcomingRenewals(daysAhead)` in `src/lib/db/organizations.ts` —
  finds organizations whose plan renews in exactly N days (7, by default),
  joining to the business profile and the owner's email.
- `GET /api/cron/renewal-reminders` — checks that request, sends the
  reminder to each match. Protected by `CRON_SECRET`: without that env var
  set, the route refuses every request (including a real cron invocation),
  so it fails closed rather than sitting open on the public internet.
- `vercel.json` — a daily Vercel Cron job (`0 8 * * *` UTC) hitting that
  route. Vercel automatically sends `CRON_SECRET` as a Bearer token once
  it's set as an env var on the project — no extra wiring needed there.

### Known limitations of this round

- The renewal check is an exact "renews in exactly 7 days" match, not a
  range — simple, and means each org gets exactly one reminder per cycle,
  but a missed or delayed cron run means that org's reminder for this
  cycle is simply skipped rather than caught up later. Fine for a
  best-effort nudge; would need a "last reminded at" column to do better.
- A blob can be orphaned (uploaded but never referenced) if the upload
  succeeds but the database write right after it fails and the mutation is
  retried — the retry uploads a fresh copy rather than reusing the first.
  Narrow, low-cost (small images), and self-limiting since old blobs are
  still cleaned up on every successful replace.
- None of this has touched a live Neon database or a real Blob store from
  inside the tool that built it — same sandbox limitation as every prior
  round. Verified via `tsc --noEmit`, `eslint`, and a full `next build`
  only.

## Update: public business website (Stage 1 of 2)

New scope: every business can now publish a simple public website at
`businessname.jktl.com.ng` — its own info, a brand color, its services and
products, and a guest booking form. Stage 2 (a scripted chat widget with a
WhatsApp link) is deliberately not built yet — this checkpoint is Stage 1
only, by design (see "Next steps" below).

**Multi-tenant subdomain routing, in the same Next.js app.**
`middleware.ts` reads the request's `Host` header; if it matches
`*.<NEXT_PUBLIC_ROOT_DOMAIN>` (default `jktl.com.ng`, also supports
`*.localhost` for local dev) and isn't a reserved host (`www`, `app`,
`api`, the apex), it rewrites the request to `/sites/<subdomain>` —
everything else (`/login`, `/business/*`, `/api/*`) passes through
unchanged. The visitor's address bar never changes; this only affects
which route Next.js resolves against. **You'll need a wildcard DNS record**
(`*.jktl.com.ng` → your deployment) for subdomains to actually resolve —
that's on your end, nothing here can do it for you.

**The public site itself is read-only, unauthenticated, and gated on
`published`.** `src/lib/db/public.ts` is a new, deliberately separate
module — the *only* place in the app that resolves a tenant from something
a random visitor typed (a subdomain) rather than from `requireSession()`.
`getPublicSiteBySubdomain` returns the profile + active services + active
products only when `business_profiles.published = true`; an unpublished or
unknown subdomain both render the same generic "not available" page, so a
visitor can't tell the difference. `src/app/sites/[subdomain]/page.tsx`
renders it via `PublicSiteView` (`src/components/public-site/`), which is
plain presentational (no store, no auth) — hero with logo/initials, brand
color background, WhatsApp/call/email buttons (numbers normalized into
`wa.me`/`tel:`/`mailto:` links in `src/lib/contact.ts`), active services
and products, and the booking form.

**Guest booking is the app's first genuinely public write path**, so it
got extra scrutiny:
- `published` gates page *visibility* only, not booking permission — an
  owner can test their own booking flow before flipping the site live.
- The subdomain resolves to an `organizationId` server-side
  (`getOrganizationIdBySubdomain`); nothing from the client is ever trusted
  as a tenant id.
- `createPublicBooking` (`src/lib/db/bookings.ts`) reads the service's
  price from the database inside the same statement as the insert, rather
  than trusting a client-supplied price — a tampered request can't book a
  service at an arbitrary amount.
- **No staff picker**, per explicit instruction — `staff_id` is always `''`
  for a public booking; assigning staff happens internally afterwards.
  Every public booking lands as `status = 'pending'`.
- A repeat guest (matched by phone, `findCustomerByPhone`) reuses their
  existing customer record instead of creating a duplicate every time.
- The business owner gets a best-effort email
  (`sendNewBookingRequestEmail`) when a request comes in — same
  fire-and-forget pattern as every other email in this app; the booking is
  saved either way even if the email fails.

**Website settings** live at `/business/website` (new entry in
`industry.nav.more`, so it's automatic for every business type): a publish
toggle, the subdomain field (client- and server-validated —
`src/lib/subdomain.ts` — 3–30 chars, lowercase/digits/hyphens, a reserved-
word list, and a live uniqueness check against Postgres), logo upload
(reuses `persistImage`, now accepting a `"logos"` folder alongside the
existing `"avatars"`/`"receipts"`), a tagline, and a brand-color picker
(native color input + presets). It renders a **live, always-in-sync
preview** using the exact same `PublicSiteView` component fed by unsaved
form state, with the booking form's submit disabled (`mode="preview"`).

**This save deliberately bypasses the offline-sync outbox** that every
other mutation in this app goes through. Subdomain uniqueness can only mean
anything against the live database, so `updateWebsiteSettingsAction` is a
plain, directly-awaited Server Action — same reasoning as the password-
change flow — and the Save button disables while offline. A new store
method, `setWebsiteProfile`, replaces the whole cached profile with the
server's canonical result afterwards rather than merging a patch through
`enqueueSync`. In demo mode, saving just updates local state directly
(nothing to publish to) — same pattern `PasswordForm` already uses for its
own demo-mode branch.

**Schema**: `migrations/003_public_sites.sql` adds `published` (boolean,
default false), `tagline`, and `theme_color` to `business_profiles`.
`subdomain` and `logo_url` already existed and are reused as-is — remember
to run `npm run db:migrate` before trying any of this against a real
database (see the earlier incident in this file where forgetting that step
broke sale creation — same category of mistake, now with three more new
columns).

### Known limitations of this round

- No DNS was configured or verified from here — wildcard subdomain
  resolution depends entirely on the DNS record you add on your end.
- The booking-confirmation email to the *guest* (as opposed to the new-
  booking notification to the *owner*) isn't sent for public bookings —
  the existing `sendBookingConfirmationEmail` only fires when a staff
  member confirms a booking from the dashboard, same as before this
  feature existed. Worth adding once Stage 2 is underway if it turns out
  guests expect it immediately.
- As with every prior round, none of this has been exercised against a
  live Neon database, a live subdomain, or a real WhatsApp number from
  inside the tool that built it — verified via `tsc --noEmit`, `eslint`,
  and a full `next build` (including the new `/sites/[subdomain]` route
  and `middleware.ts` compiling and being listed as Proxy/Middleware in
  the build output) only.

## Update: fixed a crash from an un-migrated database

You hit this immediately after checkpoint14, and it's the same category of
mistake as the earlier sale-creation incident: **migration 003 hadn't been
run yet**, so `business_profiles` didn't have `tagline`/`theme_color`/
`published` columns. Saving website settings failed loudly (a clear
Postgres error, caught and shown as "Couldn't save your website settings"),
but simply *reading* the profile elsewhere degraded silently instead —
`SELECT *` against a table missing those columns just omits those keys
rather than erroring, so `profile.themeColor` came back `undefined`, which
crashed the color picker (`value.toLowerCase()` on `undefined`).

Two fixes:
1. **The real fix, on your end**: run `npm run db:migrate` — this adds the
   missing columns and everything works.
2. **Defensive fixes here regardless**: `mapProfile` in both
   `src/lib/db/organizations.ts` and `src/lib/db/public.ts` now falls back
   to sane defaults (`""`, `false`, `"#0f6e5c"`) instead of passing through
   `undefined`; `ColorPicker` validates its `value` prop and falls back to
   the default brand color rather than crashing if it ever gets handed
   something unexpected again. None of this replaces actually running the
   migration — it just means a similar gap won't take down the whole page
   next time.

## Update: fixed the middleware swallowing `business.jktl.com.ng` itself

Real-world deployment turned up something the sandbox couldn't: this app
isn't deployed on the apex domain — it's its own Vercel project at
`business.jktl.com.ng`, sharing that project (and the `*.jktl.com.ng`
wildcard) with the dashboard itself, alongside separate sibling projects
at `admin.jktl.com.ng` and `accounts.jktl.com.ng` on their own domains.

`middleware.ts`'s reserved-host list only knew about `www`/`app`/`api`/the
apex — it had no idea `business` was itself a real, fixed part of the
platform rather than a tenant's chosen subdomain. So a visit to
`business.jktl.com.ng` was being rewritten to `/sites/business`, and since
no business had published a site with the literal subdomain `"business"`,
it showed the generic "this site isn't available" page instead of the
actual dashboard/login.

Fixed by adding `business`, `admin`, and `accounts` to `RESERVED_HOSTS` in
`middleware.ts` (so they always pass straight through, whichever Vercel
project actually serves them) and to `RESERVED_SUBDOMAINS` in
`src/lib/subdomain.ts` (so a business can never pick one of those words as
their own site's subdomain in the first place — same reserved list backing
both the live-typing validation and the server-side check). Also added a
`RESERVED_APP_SUBDOMAINS` env var (comma-separated) so any *other* fixed
subdomain that comes up later — a new internal app on its own subdomain,
say — can be reserved with just an env var + redeploy, no code change.

**If you add another fixed subdomain in the future**, set
`RESERVED_APP_SUBDOMAINS` to a comma-separated list on the Vercel project
that owns the wildcard domain, or ask for it to be added to the hardcoded
list directly.

## Next steps

**Stage 2, deferred on purpose**: a scripted (non-AI) chat widget on the
public site, plus a WhatsApp link/button — already partly here in the form
of the WhatsApp button in the hero, but the actual scripted-conversation
widget itself hasn't been started. Confirm Stage 1 works end-to-end
against a real database and a real subdomain first.

Otherwise, nothing outstanding from the original spec. What's left is
either optional infrastructure (connect Blob storage and/or the renewal
cron whenever you want them live — both are inert until their env vars are
set, and Blob storage is now also where a new logo upload would go) or
genuinely new scope (a second business vertical with real industry-
specific fields) — not bugs or gaps in what's already built.
