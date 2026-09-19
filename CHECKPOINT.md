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

## Update: Stage 2 — the scripted chat widget

Every published business site now has a floating chat bubble (bottom-right,
themed in the business's brand color). It's a **scripted decision tree, not
an LLM** — every line it says is computed live from the business's real
services, products, and contact details already loaded on the page; nothing
is generated or invented, and no network call happens when it "talks." A
short typing-indicator pause before each reply is the only thing making it
*feel* conversational — that was the brief ("feels like AI is chatting"
achieved through UX, not through an actual model).

**Files**: `src/components/public-site/chat-widget.tsx` (the widget itself)
and small additions to `public-site-view.tsx` (renders it, live mode only)
and `public-booking-form.tsx` (accepts a service pre-selected from chat).

**What it can do** — a small hard-coded conversation tree with quick-reply
buttons only (deliberately no free-text input, which is what keeps this
honestly "scripted" instead of implying more than it is):
- **Services & prices** — lists active services with price/duration, then
  offers "Book <service>" for the first few, which jumps straight to the
  booking form below with that service already selected.
- **Products** — lists active products with price and a sold-out note.
- **Book an appointment** — scrolls straight to the booking form.
- **Where are you located?** — the profile's address, or an honest "we
  haven't added one" if it's blank.
- **Chat with a person** — opens the same WhatsApp link as the hero button;
  falls back to a "Contact us" node (phone/email) if no WhatsApp number is
  on file.

Every node degrades honestly when data is missing (no services listed, no
address, no phone) rather than making something up or dead-ending silently.

**A design note for future maintenance**: the "book a specific service"
hand-off works by lifting a `prefillServiceId` piece of state up into
`PublicSiteView`, passed down to both the chat widget (which sets it) and
the booking form (which reads it as `initialServiceId`). Two spots needed
non-obvious React patterns to satisfy this codebase's
`react-hooks/set-state-in-effect` lint rule (the same one that shaped the
`AddToHomeScreenGuide` fix earlier): the widget's "say the greeting the
first time it opens" logic lives in the launcher button's click handler
rather than a `useEffect` reacting to `open`, and the booking form's
`initialServiceId` prop sync uses React's documented "adjust state during
render" pattern (comparing against a `prevInitialServiceId` piece of state)
instead of an effect. Both avoid an extra render pass and are what the lint
rule is actually steering toward — worth reusing this pattern rather than
reaching for a plain `useEffect` next time a child needs to react to a
prop change that isn't available at first render.

**Known limitation**: like `PublicBookingForm`, the widget's `fixed`
positioning means it isn't rendered at all in the settings page's embedded
preview (it would float over the whole dashboard, not just the preview
frame) — it only ever appears on the real, live public page.

## Next steps

Nothing outstanding from the original "business website" request — both
stages (the public site and the scripted chat widget with WhatsApp) are
built. Worth using the real site for a while and seeing what businesses
actually ask the chat widget that it can't answer yet (opening hours is
the obvious gap — there's no hours field in the data model at all right
now, salon or otherwise) before adding more nodes to the tree.

Otherwise, nothing outstanding from the original spec. What's left is
either optional infrastructure (connect Blob storage and/or the renewal
cron whenever you want them live — both are inert until their env vars are
set, and Blob storage is now also where a new logo upload would go) or
genuinely new scope (a second business vertical with real industry-
specific fields) — not bugs or gaps in what's already built.

## Update: "Website & Hosting" billing — real Paystack subscriptions

**The business model**: JKTL Business itself (CRM, bookings, sales,
inventory, invoices...) is free forever. The one thing that costs money is
the public website (Stage 1/2 above) — hosting, database and storage for
it — billed as a separate add-on. This turns the `infrastructure_accounts`
table (which already existed from an earlier phase as a purely
informational display — seeded at signup with `plan_name = 'Business
Starter'`, `price_kobo_per_year = 5,000,000`, never actually charged, and
not even rendered anywhere in the UI) into a real, Paystack-backed
subscription that the app genuinely enforces.

**Pricing** — four cycles, cheapest per-year when paid annually (the
standard SaaS pattern, and it happens to land almost exactly on Bumpa's
own live pricing, the closest real comparable):

| Cycle | Price | Annualized |
|---|---|---|
| Monthly | ₦5,000 | ₦60,000/yr |
| Quarterly | ₦14,500 | ₦58,000/yr |
| Every 6 months | ₦27,000 | ₦54,000/yr |
| Yearly | ₦50,000 | ₦50,000/yr |

Defined once in `src/lib/billing.ts` (`BILLING_CYCLES`) — shared by the
checkout action, the webhook, and the Settings UI, so the prices only ever
live in one place.

**What's gated**: only `published: true` on the website-settings save
(`updateWebsiteSettingsAction` in `business-actions.ts`) — checked via
`isSubscriptionActive(orgId)` in `src/lib/db/billing.ts`. Turning the
Publish toggle off, or saving any other website setting (tagline, color,
logo) while unpublished, stays free. Nothing else in the app checks this
at all.

**Schema** (`migrations/004_billing.sql`): extends
`infrastructure_accounts` with `billing_cycle`, `subscription_status`
(`inactive | active | past_due | canceled`), `price_kobo_per_cycle`, and
the three Paystack identifiers (`paystack_customer_code`,
`paystack_subscription_code`, `paystack_email_token`). Existing rows
default to `subscription_status = 'inactive'` — nobody who signed up
before this shipped had actually paid for anything, so nobody becomes
silently gated or silently "active" for free; an already-published test
site keeps working until its `renewal_date` lapses or the owner touches
Publish again. Also adds `billing_plans` (caches the 4 Paystack Plan
codes) and `paystack_webhook_events` (dedupes webhook redeliveries).

**No manual Paystack dashboard setup for Plans**: `ensurePlanCode()` in
`src/lib/db/billing.ts` creates the 4 Plan objects on Paystack the first
time any of them is needed (checking Paystack itself by name first, in
case the local cache was ever wiped), so there's nothing to configure by
hand there — just the two API keys.

**Checkout flow**: `startCheckoutAction(cycle)` → `ensurePlanCode` →
Paystack `/transaction/initialize` with the org's id in `metadata` →
returns a hosted `authorization_url` the browser redirects to. Paystack
redirects back to `/business/settings?billing=callback&reference=...`,
where `confirmCheckoutAction` verifies the transaction server-side and
activates the subscription immediately (so the UI doesn't have to wait for
the webhook). The Settings page auto-switches to the Plan tab when it
detects that query param.

**Webhook** (`src/app/api/webhooks/paystack/route.ts`) — the authoritative
source for everything that happens without a browser open: recurring
`charge.success` (renewals, matched by customer code since Paystack's own
auto-charges carry no metadata), `subscription.create` (fills in the
subscription code + authoritative renewal date), `invoice.payment_failed`
(→ `past_due`, doesn't unpublish immediately — Paystack retries the charge
on its own schedule), and `subscription.disable` / `subscription.not_renew`
(→ `canceled`, unpublishes the site right away). Verifies
`x-paystack-signature` (HMAC-SHA512 over the *raw* body) and dedupes by
`(event, subject id)` against `paystack_webhook_events`, since Paystack
retries on timeout. **You must add this URL in the Paystack dashboard**
(Settings → API Keys & Webhooks): `https://business.<your-domain>/api/webhooks/paystack`,
subscribed to at least those four events plus `charge.success`.

**Safety net for missed webhooks**: the existing daily renewal-reminders
cron now also calls `sweepLapsedWebsites()` — unpublishes any site whose
subscription isn't active *and* whose `renewal_date` has actually passed,
catching a dropped `subscription.disable` delivery. Never touches CRM data,
only `business_profiles.published`.

**New env vars** (see `.env.example`): `PAYSTACK_SECRET_KEY`,
`PAYSTACK_PUBLIC_KEY` (the public key isn't actually used server-side yet —
kept for a future client-side Paystack Inline integration if you ever want
an in-page checkout instead of the current redirect-to-Paystack flow), and
optionally `NEXT_PUBLIC_APP_URL` if the dashboard isn't simply
`business.` + `NEXT_PUBLIC_ROOT_DOMAIN`.

**Two lint patterns worth reusing** (this codebase's `react-hooks/
set-state-in-effect` rule is strict — it flags a synchronous `setState`
call sitting directly in an effect body, even one that's about to kick off
an async fetch): (1) when the *initial* value of a piece of state depends
on a one-time check of something only available in the browser (here,
`window.location.search` right after a redirect), compute it via a lazy
`useState(() => ...)` initializer instead of setting it from inside an
effect — see `billing-panel.tsx`'s `confirming` state and
`settings/page.tsx`'s `tab` state. (2) when an event handler needs to
navigate the page (`window.location.href = ...`), the separate
`react-hooks/immutability` rule flags mutating `window.location` directly
in the handler ("modifying a variable defined outside a component") — the
fix is to have the handler only set a `redirectUrl` state value, and do
the actual `window.location.href = redirectUrl` assignment inside a
`useEffect` that reacts to it (see `subscribe()` / the redirect effect in
`billing-panel.tsx`).

**Known limitation — not live-tested**: this sandbox has no network route
to `api.paystack.co` (same restriction as `*.neon.tech`), so none of the
Paystack API calls (`ensurePlanCode`, `initializeTransaction`,
`verifyTransaction`, `getSubscriptionManageLink`, or the webhook's
signature verification against a real payload) have actually run against
Paystack. Everything is built strictly to Paystack's documented API shapes
and verified type-clean/lint-clean/build-clean, but the first real
checkout, the first real webhook delivery, and the first `next dev` request
to `/business/settings` with real Paystack keys set are all genuinely
untested — worth doing a full test-mode run-through (test API keys,
subscribe, confirm the Plan tab flips to Active, then check the Paystack
dashboard's webhook delivery log) before switching to live keys.

## Update: publishing your site is free — billing no longer gates it

Reversed the one enforcement decision from the update above, on your call:
a *.jktl.com.ng subdomain costs nothing extra per business (one shared
wildcard cert, one shared deployment — no per-tenant domain registration),
so it shouldn't be behind a paywall. It never should have been the thing
this subscription gated.

**What changed**: `updateWebsiteSettingsAction` no longer calls
`isSubscriptionActive` before allowing `published: true` — publishing (and
everything else about the website: subdomain, tagline, logo, color) is
unconditionally free now. The Website page's Publish toggle is never
disabled and the "subscribe to publish" hint is gone. The Paystack webhook
no longer unpublishes a site when a subscription is canceled
(`handleSubscriptionCanceled` just records the status now), and the daily
cron no longer runs a sweep to unpublish lapsed subscribers
(`sweepLapsedWebsites` still exists in `src/lib/db/billing.ts` but isn't
called from anywhere).

Also fixed a related bug this surfaced: `listUpcomingRenewals` (the
renewal-reminder email) was matching on `renewal_date` alone, so *every*
business — including ones who never subscribed to anything — has an
`infrastructure_accounts` row from signup with a real renewal_date, and
would eventually get a "your plan renews for ₦50,000" email regardless.
Added `AND ia.subscription_status = 'active'` so only actual subscribers
get that email.

**What this leaves**: the entire Paystack rail (checkout, webhook,
Settings → Plan panel, the 4 auto-provisioned Plans) still works exactly
as built and documented above — subscribing still charges a real card and
tracks status accurately. It just doesn't unlock or restrict anything
right now, which the code comments and the Plan tab's own copy now say
plainly, so nobody reading the code later mistakes "subscription_status"
for something actually enforced. `isSubscriptionActive` and
`unpublishSite` in `src/lib/db/billing.ts` are unused but left in place —
whatever gets built next that has a genuine per-business cost (a custom
domain, storage past a free quota) can reuse them directly.

## Next steps

**Open question, worth deciding before anyone actually subscribes**: since
publishing is free, what should the Website & Hosting plan actually unlock?
The two candidates that fit the original "bill for real infra cost" idea:
- **A custom domain** — letting a business point their own purchased
  domain (e.g. `www.glamhairstudio.com`) at their JKTL site instead of a
  subdomain. This has a genuine per-business cost (DNS verification,
  issuing/renewing a dedicated SSL cert) and doesn't exist as a feature
  yet — building it is real scope.
- **Storage past a free quota** — Blob storage (logos, receipts, product
  photos) is the one thing that scales with usage. Could gate "extra GB of
  storage" behind the plan while leaving a generous free allowance for
  everyone (the base64-in-Postgres fallback already covers a no-Blob-token
  setup entirely for free, so this would specifically be about real Blob
  storage beyond some limit).

Neither is built. Everything else from before still stands: the live
test-mode Paystack run-through (subscribe with test keys, confirm the Plan
tab flips to Active, check the webhook delivery log) is worth doing once
there's an actual reason to subscribe; the schools vertical stays deferred
("when I'm ready I'll develop it"); CSV import was the top integrations
recommendation but hasn't been requested as a build yet.

## Update: the three real gates — team seats built, storage + custom domain scoped

Settled what the subscription actually pays for: three things with a real
per-business cost, rather than the free subdomain/hosting. **Team seats**
is built now; storage and custom domain are scoped but not built pending
two open decisions (see below).

**Team seats** — the free tier is the owner alone (`FREE_TEAM_SEATS = 1` in
`src/lib/billing.ts`); adding a 2nd+ team member needs an active
subscription. Enforced in `addMemberAction`
(`src/lib/actions/member-actions.ts`) via a new `countMembers()` in
`src/lib/db/members.ts` plus `isSubscriptionActive()` — this is what makes
`isSubscriptionActive` a real, used check again (it had gone dormant when
website-publishing gating was removed above). The Settings → Users tab
also checks this up front (`canAddMember` in `settings/page.tsx`): the
"Add" button jumps to the Plan tab instead of opening the add-member sheet
once at the limit, and a note explains why.

**Note on how this interacts with the offline outbox**: adding a team
member goes through the same optimistic local-update-then-sync pattern as
every other mutation (`addMember` in `store.ts` → `enqueueSync` →
`addMemberAction` once back online). So a business at the seat limit can
still *try* to add someone while offline — the UI updates optimistically,
and only once the queued mutation reaches the server does
`addMemberAction` reject it. `processOutbox` (`src/lib/offline/sync.ts`)
already handles a rejected mutation generically (drops it, shows "One
change couldn't be saved to the server and was discarded"), so this
doesn't crash or hang, but the toast doesn't say *why* it was rejected,
and the phantom member stays visible in the list until the next full
re-sync corrects it. The client-side `canAddMember` check above is what
keeps this the rare path rather than the common one — same reasoning
`updateWebsiteSettingsAction` uses for being a direct, non-outbox action
instead (subdomain uniqueness has the same "needs a live check" shape).
Worth remembering if a future gate has the same tension.

**Storage and custom domain — not built yet, two decisions pending**:
- **Storage free quota**: you said "50 or 100mb" — need one number. Once
  picked, this needs real enforcement, which doesn't exist yet: nothing
  currently updates `storage_used_gb` on an upload, so `persistImage` in
  `src/lib/blob.ts` would need to start tracking bytes per organization,
  and a check added before allowing a new upload past quota (logos,
  receipts, product photos are the only real usage today).
- **Custom domain**: a genuinely new feature, not a small gate — the
  business would need a way to enter their own domain, prove they own it
  (a DNS TXT record is the standard way), and `middleware.ts` would need a
  second resolution path (host doesn't match `*.jktl.com.ng` → look up
  `business_profiles` by a new `custom_domain` column instead of by
  subdomain). The remaining question is whether the domain itself also
  gets added to the Vercel project automatically via Vercel's API (needs a
  Vercel API token + project ID from you) or manually by you in the Vercel
  dashboard each time (matches how you already manage `jktl.com.ng`'s
  wildcard — no new credential needed, but a manual step per business).

## Update: storage quota + custom domain — both gates built and live

Closed out the two open decisions from the update above and built both
remaining gates. Nothing about website publishing changed — it's still
free and ungated.

**Storage quota — 50MB free per business, grounded in Neon's real
pricing.** You'd said "im using neon so use that information for data"
rather than picking a number blind, so: JKTL Business runs one shared
Neon project across every tenant, and Neon's free tier is 512MB **total
for the whole platform**, not per business — the paid tier is metered at
$0.35/GB-month with no hard cap. 50MB per business
(`storage_limit_bytes`, defaults to `52_428_800` bytes) is generous
enough that almost no real salon hits it from normal use (a logo plus a
season's worth of receipt photos), while keeping the platform's
aggregate free-tier usage predictable — roughly 10 businesses' worth of
headroom before any of them even need to pay, and paid usage past that
costs cents, not naira, so the ₦5,000+/mo subscription price comfortably
covers it.

- **What's actually measured**: only image uploads — logos, staff
  avatars, receipt photos — via a new `image_uploads` table (one row per
  upload, exact byte size) and a running `storage_used_bytes` counter on
  `infrastructure_accounts` (`migrations/005_storage_and_custom_domain.sql`).
  Deliberately not full database-row accounting: plain CRM rows are
  negligible next to photos even for a busy business, so this is a
  "good enough" proxy rather than instrumenting every table.
- **Enforcement** (`src/lib/db/storage.ts`, wired into `src/lib/blob.ts`):
  `hasStorageQuota(orgId, size)` is checked *before* any upload happens
  (Blob or inline fallback) — if the org is at quota, `persistImage` throws
  a `StorageQuotaError` instead of storing anything, and an active
  subscription lifts the quota entirely (no separate "paid quota" ceiling,
  just free-vs-unlimited). Every action that uploads an image
  (`setAvatarAction`, `createSaleAction`/`updateSalePaymentAction`'s
  receipt photo, `updateWebsiteSettingsAction`'s logo) now passes
  `organizationId` through and catches `StorageQuotaError` with the
  upgrade message. `releaseImage` (renamed from `deleteImageIfBlob`)
  subtracts the freed bytes back off the counter on replace/removal,
  floored at 0.
- **UI**: a new `StorageUsagePanel` (`src/components/settings/storage-usage-panel.tsx`)
  in Settings → Plan, right under the billing panel — a progress bar plus
  "X MB / 50 MB" fetched via a new read-only `getStorageUsageAction`. This
  replaced the old static "Storage: 0.8 GB / 2 GB" row in the
  pre-existing "Infrastructure status" section, which was never wired to
  anything real.

**Custom domain — manual DNS verification, no Vercel API.** You picked
"Manual — you add it in Vercel yourself" explicitly, matching how you
already manage `jktl.com.ng`'s own wildcard domain by hand. So JKTL
Business only verifies the business controls the domain and remembers
the mapping; actually adding the domain to the Vercel project (so Vercel
issues its SSL certificate) is still a manual step you or the business
does in the Vercel dashboard — no Vercel API token anywhere in this flow.

- **Flow**: business enters a domain (e.g. `www.glamhairstudio.com`) →
  `startCustomDomainVerificationAction` (requires an active subscription —
  this is the one thing with a real ongoing cost, one more host for
  middleware to resolve plus whatever SSL renewal costs you in Vercel)
  generates a random token and returns a DNS TXT record to add
  (`_jktl-verify.<domain>` → `jktl-domain-verify=<token>`) → business adds
  it at their registrar → `verifyCustomDomainAction` resolves the TXT
  record via Node's `dns/promises.resolveTxt` and marks it verified on a
  match. A partial unique index on `business_profiles.custom_domain`
  (`WHERE custom_domain <> ''`) stops two businesses claiming the same
  domain.
- **Routing**: `middleware.ts` now runs two checks — the existing
  `*.jktl.com.ng` string match first (zero cost, virtually all traffic),
  then, only for hosts that are neither that namespace nor localhost
  (`isCandidateCustomDomain`), one DB lookup
  (`getSubdomainByCustomDomain`) that resolves a verified custom domain
  back to the business's own subdomain slug and rewrites to the exact
  same `/sites/<subdomain>` route — a custom domain is an alternate
  address for the same site, not a separate page.
- **UI**: `CustomDomainField` (`src/components/website/custom-domain-field.tsx`)
  on the Website settings page, right under the subdomain field —
  handles all four states (not subscribed / no domain yet / pending
  verification with instructions / verified), and reminds the business to
  add the domain in Vercel once verified.

Both features work in demo mode too (faked locally via the store, no real
server calls or DB writes), same pattern as the billing panel.

## Update: public website redesign, product photos, report charts, dark mode

Four separate asks bundled into one round. Migration `006_website_v2.sql`
adds `business_profiles.cover_photo_url` and `products.image_url` — both
optional, both flow through the existing storage-quota machinery
(`persistImage`/`releaseImage`/`StorageQuotaError`) exactly like a logo or
receipt photo already did.

**Public website — now a real landing page, not a single-column mobile
list.** `src/components/public-site/public-site-view.tsx` was rewritten
end to end:
- **Nav bar**: sticky, business name/logo on the left, anchor links
  (Services/Products/Pricing — whichever sections actually have content)
  in the middle on wider screens, a "Book now" pill always on the right.
- **Hero**: full-bleed cover photo (new `coverPhotoUrl` on
  `BusinessProfile`, uploaded via `CoverPhotoField` — a 16:9 center-crop,
  same client-crop-then-upload-on-save pattern as the logo) with a dark
  gradient for text legibility; falls back to a brand-color gradient when
  no photo is set, so it's never blank. Business name, tagline, location,
  and three CTAs (Book, WhatsApp, Call).
- **Products, as "mini ecommerce"**: per your call — a catalog to browse,
  not a cart. Each product can now have a photo (`imageUrl`, uploaded via
  `ProductPhotoField` in the product form, also shown as a thumbnail in
  the internal Products list). An "Order" button opens WhatsApp with the
  product name and price pre-filled (`waLink` in `src/lib/contact.ts` now
  takes an optional `message` param) — no cart, no online payment, matches
  how these businesses already close sales.
- **Pricing section**: your ask was "a list of everything they will pay
  for" — so this is a dedicated section, separate from the visual product
  catalog above it, listing every active service and every active product
  with its price in one place, grouped under "Services"/"Products"
  sub-headings. Nothing hidden behind menu-hunting.
- General visual pass to move it away from looking like the internal
  dashboard's card grid: wider container (`max-w-6xl` vs. the dashboard's
  mobile-first width), generous section padding, a colored eyebrow label
  above each heading, alternating section backgrounds for rhythm. The
  booking form and the scripted chat widget are unchanged, just restyled
  to sit inside the new layout.

**Charts on the Reports page** (`src/app/business/reports/page.tsx`):
added the `recharts` dependency. A sales-vs-expenses bar chart
(`salesTrendInRange` in `src/lib/selectors.ts` — bucketed by hour for
"Today", by day for "This week"/"This month") sits above the existing stat
tiles, and the booking-status counts are now also a donut chart next to
the existing pill breakdown (kept both — the chart for the shape, the
pills for the exact numbers). Chart colors reference the CSS color
variables directly (`fill="var(--color-primary)"` etc.) rather than hex,
so they automatically follow dark mode.

**Dark mode — dashboard only, per your call.** `globals.css` now defines a
dark palette two ways: under `@media (prefers-color-scheme: dark)` guarded
by `:root:not([data-theme="light"])` for "System", and again under
`:root[data-theme="dark"]` for an explicit choice. `layout.tsx` sets
`data-theme` on `<html>` via a small blocking inline script (reads
`localStorage`) before paint, so there's no flash of the wrong theme.
`ThemeToggle` (Settings → Account → Appearance) is the only thing that
writes that `localStorage` key. The public website is deliberately
**exempted** — it always renders light, via a `.jktl-light` class on its
own root element that re-declares the light color values; CSS custom
properties resolve from the nearest ancestor that sets them, so this wins
over both the media query and `[data-theme="dark"]` without any JS. A
storefront a customer visits from a WhatsApp link shouldn't flip dark just
because their phone is in dark mode at 9pm.

## Update: "Upgrade" popup + wording pass

Per your ask — tease the gated features and let people upgrade right from
where they hit the gate, instead of sending them off to Settings → Plan
and hoping they find their way back.

**`UpgradeSheet`** (`src/components/settings/upgrade-sheet.tsx`, new) is
the one shared popup for this. It takes a `reason` string (the one line
that explains *why* this particular gate exists) and renders the same
billing-cycle picker as the Plan tab — choosing a cycle starts a real
Paystack checkout right there, same `startCheckoutAction` the Plan tab
uses. There's exactly one place that knows how to start a checkout from a
gate, not three copies of the same logic.

Wired into all three real gates:
- **Custom domain** (`custom-domain-field.tsx`) — not-subscribed state now
  shows an "Upgrade" button instead of the old plain message.
- **Team seats** (Settings → Users) — the "Add" button opens the sheet
  directly when the free seat is used up, instead of just switching to the
  Plan tab; the explanatory line under it also has an inline "upgrade"
  link that opens the same sheet.
- **Storage** (`storage-usage-panel.tsx`) — once the free 50MB is used up,
  an "Upgrade for more storage" button appears under the usage bar.

**Wording pass**: replaced "Subscribe"/"subscribing" with "Upgrade"/
"upgrading" everywhere a person actually sees it as an instruction or
action — the `StorageQuotaError` message, the team-seat and custom-domain
gate error strings, the Plan tab's own description line, and the demo-mode
toast on the Plan tab's cycle picker. Left alone on purpose: things that
describe *state* rather than prompt an action — the "Not subscribed"
status pill, `subscriptionStatus`/`subscription_status` (the actual
Paystack/DB field name), and code comments — since renaming those wouldn't
change anything a person sees and would just make the code harder to
grep against Paystack's own docs.

Verified with `tsc --noEmit`, `eslint .`, and a full production build —
all clean.

## Investigated: "the website new layout is not implemented"

Checked this by re-reading the actual files, not by guessing: `src/app/
sites/[subdomain]/page.tsx` (the real public site route, `force-dynamic`
so it's never statically cached) and `src/app/business/website/page.tsx`
(the dashboard's live preview) both still render the new
`public-site-view.tsx` — the nav bar, hero, services grid, product
catalog, and consolidated pricing section are all there in the file on
disk. There's no old/duplicate version of this page anywhere in the
project that could be shadowing it. So this isn't a missing or reverted
feature.

The far more likely explanation is the **same service-worker caching
issue already root-caused earlier** (the `formatMb`/`ChunkLoadError`
reports): `AppBootstrap`, which registers `/sw.js`, is mounted in the
*root* layout, so its scope is the whole site — including `/sites/...`
public pages, not just the `/business` dashboard. If a service worker was
ever installed in your browser from before the production-only-registration
fix, it's still running now regardless of that fix, and it's the same
worker that can end up serving an old cached page. The fix already
shipped in code doesn't retroactively un-register something the browser
already installed.

One-time fix, same as before: open DevTools → Application → Service
Workers → **Unregister**, then Application → Storage → **Clear site
data**, then hard-reload the tab. After that, this browser will only ever
register the service worker in production, never in `next dev`, so this
class of "my change isn't showing up" shouldn't recur. If you're viewing
this on a phone (no easy DevTools), the equivalent is clearing site data/
storage for the site from the browser's site-settings screen, or trying a
fresh private/incognito tab, which never has a previously-installed
worker.

If that doesn't fix it: rebuild (`rm -rf .next && npm run build`, or just
restart `npm run dev`) after extracting this latest zip over the old
project folder, since a partial extraction (old files left in place
alongside new ones) would look like the same symptom.

## Fix: image upload crashing storage-quota tracking (migration 007)

Real bug, found from your terminal log:

```
Error [NeonDbError]: index row requires 251456 bytes, maximum size is 8191
    at async recordImageUpload (src/lib/db/storage.ts:46:3)
```

**Cause**: without `BLOB_READ_WRITE_TOKEN` configured, `persistImage`
falls back to storing the image inline in Postgres as a full base64
`data:` URL (by design — the app should work with zero setup). But
migration 005 put a plain index on `image_uploads.url` to speed up
lookups. That's fine for a short, real hosted URL, but a base64-encoded
photo is easily 50–250KB, and Postgres flatly refuses to index anything
over roughly 2.7KB in a standard btree — hence the crash, on *every*
inline-stored image, not just this one upload.

**Fix**: `migrations/007_fix_image_uploads_index.sql` drops that index.
It was never actually needed — `releaseImageUsage` always filters by
`organization_id` first (which has its own index), and one business has
at most a handful of tracked images, so there's nothing to look up
efficiently by `url` alone. No application code changed, `tsc`/`eslint`
still clean.

**You'll need to run `npm run db:migrate` again** to pick this up — it's
additive (a new file, not a change to 005), so it's safe to run anytime,
same as always.

If you do eventually connect a real Vercel Blob store
(`BLOB_READ_WRITE_TOKEN`), this whole class of issue goes away regardless
— images get uploaded to Blob and only their short real URL gets recorded
here, which was always fine to index. Inline storage is meant as a
zero-setup fallback, not the long-term path for a business with real
traffic.

## Dashboard rebrand + public-site fonts, socials, about, testimonials, service photos, support button (migration 008)

A large round covering everything asked for in one go:

**Dashboard rebrand.** The dashboard itself (not the public website — see
below) now uses Cormorant Garamond (display) + Plus Jakarta Sans (body) +
JetBrains Mono, and a navy color scale (light mode: navy-700/800 primary
on a navy-50 soft background; dark mode: the full navy-950→200 scale),
replacing the old mint-green primary. `src/lib/fonts.ts` is the single
place every Google Font is loaded from; `src/app/layout.tsx` and
`globals.css` were updated to use it.

**7 accent colors, replacing the free-form color wheel.**
`src/lib/accent-colors.ts` has 7 curated, contrast-checked swatches; the
website settings page's color picker now shows only these.

**7 font pairings for public websites — "girlie" to professional.**
`SITE_FONT_PAIRS` in `src/lib/fonts.ts`: Playful, Romantic, Chic, Classic,
Bold & Glam, Modern, Professional — each its own display+body Google Font
pair, completely independent of the dashboard's own fixed brand and of
the business's chosen accent color. Picked via the new
`<FontPairPicker>` on the Website settings page; applied on the public
site through a scoped CSS custom-property override, the same pattern
already used for the public site's fixed light-mode colors.

**Public website: about, social links, testimonials, responsive nav,
motion, footer.** `src/components/public-site/public-site-view.tsx` was
substantially rewritten:
- New About section (owner-written, shown only if filled in) and a
  Reviews section built from owner-entered testimonials (`Testimonial`
  in `src/lib/types.ts`, managed from a new "Testimonials" block on the
  Website settings page — add/edit/delete, saved instantly through the
  same offline outbox as services and products, same reasoning as
  before: no public submission form, so no moderation queue needed).
- Instagram/TikTok/Facebook/Snapchat links in the footer as icon buttons
  (hand-drawn monochrome icons in `src/components/public-site/social-icons.tsx`,
  since no icon library here ships TikTok/Snapchat marks) — only the ones
  a business actually fills in are shown.
- Responsive nav: a proper hamburger menu on mobile (Framer Motion
  `AnimatePresence` open/close), plain link row on larger screens.
- Small Framer Motion touches throughout: scroll-reveal on each section,
  hover/tap feedback on buttons and cards — `framer-motion` is a new
  dependency (`package.json`).
- Footer now reads "Powered by JKTL Business", linking to
  `https://business.jktl.com.ng`.
- Services can now have a photo too (`Service.imageUrl`, same
  upload/persist/release pattern products already had) — shown on both
  the services list in the dashboard and the public site's service cards.

**Dashboard WhatsApp support.** The Help page (`src/app/business/help/page.tsx`)
now has a "Chat with support" card at the top, linking to WhatsApp
07036580994 via the existing `waLink()` helper — opens a pre-filled
WhatsApp chat, nothing sent automatically.

**Migration**: `migrations/008_website_v3.sql` adds `about_text`,
`instagram_url`, `tiktok_url`, `facebook_url`, `snapchat_url`,
`font_pair_id` to `business_profiles`, an `image_url` column to
`services`, and a new `testimonials` table — deliberately with **no
index on `quote`**, learning directly from the migration 007 bug above
(a long free-text column must never get a btree index; only
`organization_id` is indexed here). **Run `npm run db:migrate` again**
to pick this up.

Verified via `tsc --noEmit`, `eslint .`, and a full `npm run build` (this
sandbox has no route to fonts.googleapis.com, so the production build was
run once against a temporary in-repo stub of `src/lib/fonts.ts` — same
shape, no real network fetch — purely to prove everything else compiles
and prerenders; the real font-loading code you're shipping was restored
immediately after and is what's in this zip). Not visually checked on an
actual device — worth a look on your phone before you consider this done.

## Footer fix + JKTL command center (migration 009)

Two more things from this round:

**Footer**: the public site's footer now reads "Powered by *(the business's
own name)*", not "Powered by JKTL Business" — still linking to
`business.jktl.com.ng`. (The onboarding welcome note — JKTL logo, "John ·
Founder & CEO, JKTL," shown to every new account on the final onboarding
screen — was already in place from the round above; no change was needed
there.)

**Command center**: a superadmin view across every business on the
platform, at `/admin`, built exactly to the scope you picked:

- **A separate login**, not a mode on a business account. `admin_users`
  and `admin_sessions` (migration `009_admin.sql`) are two brand-new
  tables with no foreign key into `users`/`organizations`/`sessions` at
  all — a command-center credential is a completely different account,
  not a business owner with extra privileges. It even uses its own cookie
  (`jktl_admin_session`, scoped to the `/admin` path) instead of the
  business session cookie.
- **View-only.** The dashboard at `/admin` lists every business with:
  plan/subscription status, publish status, storage used, customer/
  service/product/booking/sale *counts*, total recorded revenue, when
  they signed up, and when they were last active (most recent booking or
  sale timestamp) — searchable by name and filterable by business type.
  Nothing here edits, suspends, or logs into a business account; that's
  deliberately not built, per what you picked.
- **Account-level only — no drill-down.** The query behind this
  (`src/lib/db/admin.ts`) returns counts and sums, never an actual
  customer, booking or sale row. A business's operational records are
  only ever visible from that business's own dashboard.

**There's no signup page for this — on purpose.** The only way to create
or reset a command-center login is from a terminal with database access:

```
npm run admin:create -- "John" "john@jktl.com.ng" "a-strong-password"
```

(or set `ADMIN_NAME`/`ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars and run
`npm run admin:create` with no arguments). Safe to re-run for the same
email — it resets that account's password rather than erroring, so this
also doubles as "I forgot it." Requires 8+ characters given what this
account can see. Once created, sign in at `/admin/login` on your deployed
app (e.g. `https://business.jktl.com.ng/admin/login`).

**Run `npm run db:migrate` again** to pick up migration 009, then run
`npm run admin:create` once to make your own login before trying `/admin`.

Verified via `tsc --noEmit`, `eslint .`, and a full `npm run build` (same
temporary font-stub approach as the round above — this sandbox has no
route to fonts.googleapis.com; the real font code is what's shipped). Not
live-tested against a real database or visually checked — worth creating
your admin login and looking at `/admin` for real before relying on it,
especially since it's now querying data across every business at once
rather than one tenant at a time like everything else in this app.

## Next steps

All three billing gates (team seats, storage, custom domain), all four
asks from the landing-page round (redesign, product photos, report
charts, dark mode), the Upgrade-popup/wording pass, last round's dashboard
rebrand + public-site fonts/socials/about/testimonials/service photos/
support button, and this round's footer fix + command center are built
and live. Worth doing before relying on any of it: run `npm run db:migrate`
again to pick up migrations 007 through 009, run `npm run admin:create`
once to get your own `/admin` login, the real test-mode Paystack
run-through already noted earlier, a visual pass on an actual phone/
desktop for the new public site and the rebranded dashboard, and the
service-worker unregister step above if a UI change still isn't showing
after an update (all of this was built and verified via `tsc`/`eslint`/a
full production build, not by looking at it rendered — I have no way to
screenshot it from here).

Queued for after this: adding new business types (nail tech, lash tech,
nail & lash studio) and removing the dashboard's "Quick Actions" section —
explicitly deferred per your own "once this is done" framing, not
forgotten.

## Round: migration bug fix + real push notifications (replacing the email placeholder)

### The migration failure, root-caused

You hit this running `npm run db:migrate` on a real database:

```
Applying 005_storage_and_custom_domain.sql ...
Migration failed: index row requires 134864 bytes, maximum size is 8191
```

**Cause:** this project's migration runner (`scripts/migrate.mjs`) has no
migration ledger — every single run replays *every* `.sql` file in
`migrations/`, in order, from 001 onward, relying on `IF NOT EXISTS`
everywhere for safety. Migration 005 originally created a btree index on
`image_uploads(url)`. That's fine for a normal URL, but this app also
lets `url` hold an inline base64 `data:image/...` string when Vercel Blob
isn't configured — and Postgres btree indexes cap out at 8191 bytes per
row, so any base64 image over roughly 2.7KB blows the index up. A later
migration (007) already *dropped* that broken index — but because 005
itself still contained the `CREATE INDEX` statement, every full replay
(which is what happens on a fresh `db:migrate` run against a database
that already has this data) recreated the exact same broken index and
failed again, blocking every migration after it (006, 008, 009, 010) in
the same run.

**Fix:** removed the `CREATE INDEX` line directly from migration 005
itself (not just relying on 007's `DROP`), with a comment explaining why
editing an old migration file — rather than only adding a new one — is
the correct move under this "replay everything, forever" model. The
org-scoped index on `image_uploads` (`idx_image_uploads_org`) stays; only
the one on the raw `url` column is gone for good. Also improved
`migrate.mjs`'s failure output to print Postgres's `.detail`/`.table`/
`.column`/`.constraint`/`.schema`/`.code` fields, not just the message, so
any future migration failure is easier to pin down without guessing.

**Run `npm run db:migrate` again** — it will now get past 005 cleanly and
pick up everything through migration 010 (below) in the same run.

### Push notifications, replacing the "Daily summary email" placeholder

The Settings page used to say "Actual emails send once Resend is
connected in Phase 2" next to a set of toggles that didn't persist
anywhere. That's gone. In its place: real, working Web Push notifications
— no email involved, nothing waiting on "Phase 2."

**What it looks like:** Settings → Notifications now has one master
"Push notifications" toggle (this is what actually subscribes your
browser — tapping it on asks for notification permission and registers
your device) plus four category toggles underneath it: new bookings, low
stock, invoice paid, and a daily summary. Each persists per-business in
the database and can be flipped independently.

**What triggers a push, and when:**
- **New booking** — fires the moment a customer books, so you don't have
  to keep the dashboard open to know one came in.
- **Low stock** — fires only the moment a product's stock *crosses into*
  at-or-below its low-stock threshold (from a sale, a manual stock
  adjustment, or an edit to the product itself) — not on every sale
  afterward while it's already low, so it can't spam you.
- **Invoice paid** — fires when an invoice's status is set to paid.
- **Daily summary** — a once-a-day push (6am WAT / `Africa/Lagos`) with a
  recap of yesterday's bookings, sales revenue, and new customers, sent
  by a new scheduled job (`/api/cron/daily-summary`, same `CRON_SECRET`-
  gated pattern as the existing renewal-reminders cron, added to
  `vercel.json`). It only covers yesterday because Vercel's free/Hobby
  plan only allows daily-granularity cron schedules — there's no way to
  run a more frequent "reminder ahead of your next booking" job on that
  tier, so booking notifications are immediate/event-based instead of
  scheduled ahead of time.

Every notification send is best-effort and wrapped so it can never break
the action that triggered it (same pattern as existing email sending) —
if push isn't configured yet, or a send fails, the booking/sale/invoice/
stock update still succeeds normally.

**One-time setup required before any of this actually sends anything:**
push notifications need a VAPID key pair (the standard way a server
proves its identity to push services like Chrome's or Firefox's). Without
it, the toggle is there and flips, but nothing is delivered — same
"missing integration never breaks the app" behavior as `RESEND_API_KEY`.
Generate one once:

```
npm run push:generate-keys
```

That prints a public and private key. Set all three of these in your
deployment's environment variables (see the updated `.env.example` for
the full explanation of each):

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<the public key, verbatim>
VAPID_PRIVATE_KEY=<the private key, verbatim>
VAPID_SUBJECT=mailto:support@jktl.com.ng
```

New tables (migration 010): `notification_preferences` (one row per
business — the master switch plus the four category flags) and
`push_subscriptions` (one row per subscribed device/browser, keyed by its
unique push endpoint so the same business can have several devices
subscribed, e.g. phone + laptop).

Verified via `tsc --noEmit`, `eslint .`, and a full `npm run build` (font-
stub technique again). Not live-tested against a real push service or a
real database — worth generating your VAPID keys, setting them, running
the migration, and toggling push on for real once this is deployed.

## Round: Quick Actions removed, invoice payment links, and command-center broadcasts

### Quick Actions removed

The dashboard's "Quick actions" grid (New sale / New booking / Add
customer / Add product) is gone from `src/app/business/page.tsx`, per
your request — everything there was already one tap away from the bottom
nav anyway.

### Invoice payment links — customers can now pay online, straight to your bank

Run `npm run db:migrate` to pick up migration 011, then you're set up —
no new environment variables, this reuses your existing `PAYSTACK_SECRET_KEY`
/`PAYSTACK_PUBLIC_KEY`.

**How it works, end to end:**
1. You enter your bank account once, in Settings → Payments — pick your
   bank, type your account number, tap "Verify account" (this calls
   Paystack's bank-resolve API and shows back the real account name on
   file, so a typo is caught before anything is saved, never trusting a
   name you typed yourself), then "Save". This creates a Paystack
   Subaccount behind the scenes (`src/lib/paystack.ts`'s
   `createSubaccount`) and stores it in a new `payment_settings` table.
2. On any unpaid invoice, "Share payment link" opens WhatsApp with a
   message and a link pre-filled to that customer's number (converted from
   local `0805...` format to the international form WhatsApp needs — see
   `toWhatsAppNumber` in `src/lib/format.ts`); "Copy payment link" copies
   the same link for pasting anywhere else.
3. The customer opens `business.<yourdomain>/pay/<invoice-id>` — a public
   page needing no login — sees the invoice and taps "Pay now", which
   opens a hosted Paystack checkout (card, bank transfer, USSD, whatever
   Paystack offers). If you haven't set up your bank yet, this page shows
   the invoice with a "please pay directly" note instead, plus your bank
   details as a manual-transfer fallback if you've entered them.
4. **The split happens automatically, inside that one Paystack charge**:
   the invoice amount goes straight to your Subaccount (your bank
   account), and a flat **₦50** goes to JKTL's main account —
   `transaction_charge` in `initializeInvoicePayment`. The customer pays
   invoice total + ₦50; you always receive the full invoice amount. Paystack's
   own processing fee comes out of JKTL's ₦50 cut (`bearer: "account"`),
   never out of your side of the split.
5. Paystack's `charge.success` webhook (already configured, from the
   billing setup) marks the invoice paid, records the Paystack reference,
   and fires the same "Invoice paid" push + customer email as manually
   tapping "Mark as paid" always has — both paths now go through one
   shared `finalizeInvoicePaid` helper (`src/lib/invoice-finalize.ts`) so
   they can never drift apart.

An invoice's own id doubles as its payment link's secret — it's already a
`crypto.randomUUID()` for every real (non-demo) invoice, the same
128-bit-random id Postgres uses as its primary key, so there's no
separate token to manage or leak.

**Worth knowing:** I couldn't test this against a live Paystack account
or real bank details from here — I read Paystack's own docs for
Subaccounts, bank-resolve, and split-payment fields to build this
correctly (business-name/bank-code/account-number for creating a
Subaccount; `transaction_charge` + `bearer` for the flat-fee split), but a
real test-mode run-through once you're set up is worth doing before
relying on it. This is also worth being aware of as a real merchant-of-
record / money-routing feature, not just a UI addition — you're now
sitting between customers and businesses' bank accounts and taking a cut
per transaction, which is a meaningfully different posture than the
subscription billing you already had.

### Command-center broadcasts — downtime notices and promotions

New tab at `/admin/broadcasts`. Pick a category (downtime notice /
promotion / other), write a title and message, optionally a link to open
when tapped, and send — it goes out as a real push notification to every
business that has push turned on. Reuses the exact same push
infrastructure as booking/low-stock/invoice-paid notifications, just
fanned out across every business's subscriptions at once
(`listBroadcastSubscriptions` in `src/lib/db/push.ts`) instead of one.

A business can opt out of these specifically — a new "Platform updates"
toggle in Settings → Notifications, on by default, separate from their
own booking/stock/invoice alerts (per your call on keeping it a distinct
toggle rather than tying it to the master push switch). Every broadcast
is logged in a new `admin_broadcasts` table with how many devices it
actually reached, shown as a history under the send form.

### On "I can't log into admin"

Almost certainly explained by the migration bug from the round above:
migration 009 (the one that creates `admin_users` in the first place)
never got to run, because migration 005's broken index blocked everything
after it. That's fixed now — run `npm run db:migrate` again (it'll pick
up 009, 010, and this round's 011 in one pass), then `npm run admin:create`
once more. If it still doesn't work after that, the actual error message
`db:migrate` or `admin:create` prints will say exactly why.

Verified via `tsc --noEmit`, `eslint .`, and a full `npm run build`
(font-stub technique, same as every round). Not live-tested against a
real Paystack account, real bank details, or a real push subscriber —
worth a real test-mode payment and a real broadcast send once this is
deployed and your VAPID/Paystack keys are in place.
