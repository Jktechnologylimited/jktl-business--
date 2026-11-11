# JKTL Business: Fluid CPU audit and implemented optimisations

Date: 11 November 2026. Installed Next.js: **16.4.2**. Companion Main repository uses Next.js 16.2.9.

Changes are local and ready for review. **No deployment or push.** No live charges, production migration, email send, framework upgrade or paid service was used.

## Evidence and causes

No Vercel usage credentials/metrics were available. Findings below come from source, build output, isolated database tests and local production-server/browser checks. There is no measured CPU saving claim.

- Public pricing/template catalogue/preview pages were already prerendered. The root layout itself does not read request cookies or headers. Authenticated dashboards and tenant websites intentionally do, and require current access/billing/publishing checks.
- Root `AppBootstrap` imported the entire private offline store and hydrated it on public pages. A returning logged-in customer opening a game/preview could unnecessarily initiate tenant data reads. Service-worker registration also reran on pathname changes.
- Feature metadata was fetched every 30 seconds across app surfaces with no CDN caching. It is global public badge data, not an access-control source.
- Customer and team support polled every 15 seconds, including hidden tabs. Customer polling also re-read review history on every tick. Human chatbot handoff polling continued in hidden tabs.
- Public publication lists selected `p.*`, transferred full article bodies from PostgreSQL and then blanked them in JavaScript, including up to 200 articles per page.
- Middleware already early-returned for site metrics and static template paths but still executed for them; its matcher omitted several asset extensions.

## Implemented changes

| Area | Change | Freshness / authorisation |
| --- | --- | --- |
| Public pages/root bootstrap | Lazy-load private store bootstrap only for `/business`, `/onboarding`, `/login`, `/signup` and descendants; register service worker once per mounted app | Partner/team/site/game flows retain their own auth/actions; public browsing no longer hydrates owner offline data |
| Business workspace bootstrap | Keep existing guarded hydration and online/offline refresh listeners; returning from public pages refreshes the workspace once, without adding a full-account polling/focus loop | No shared tenant cache introduced; existing session verification and tenant-scoped sync preserved |
| `/api/public/features` | Successes: CDN and Vercel-CDN `s-maxage=60`, browser `max-age=0, must-revalidate`; preserve `Vary: Origin` and existing CORS; failures 503/no-store at all layers | Reads only global public feature fields, never sessions; access permissions are unrelated and remain current |
| Feature provider (both apps) | Visible-tab five-minute polling/focus throttle; skip unused previews/site/chatbot frames; filter expired badge data during refresh | Cosmetic updates may wait for poll plus CDN expiry; no billing/permission data cached |
| Customer/team support | Visible-tab 30-second polling, one automatic refresh at a time, bounded retry cadence, focus refresh, cleanup and stale-response generation guards | Explicit writes still trigger immediate refresh; review history reads on initial load and explicit refresh, rather than every poll |
| Public chat | Retain 15-second human-handoff refresh when visible; pause when hidden and refresh on return; bot-only history still loads once | No AI/human handoff feature removed |
| Published article SQL | Select required fields; SQL returns empty body for list queries, full body for a single slug | Existing published/time filters, stable ordering, LIMIT 200/OFFSET and privacy redaction retained |
| Middleware | Skip template/static assets and pass-through `/api/site-metrics` before invoking middleware | Tenant roots, protected routes, webhooks and tenant robots/sitemap still match; domain verification/rewrite logic unchanged |

The shared visible-polling utility avoids overlapping automatic polls, waits for completion before scheduling, pauses on hidden tabs, removes timers/listeners on unmount and waits until the next normal interval after a failure. Explicit post-mutation refreshes can supersede polls; generation guards prevent older responses overwriting newer support state. In-flight requests are not cancelled server-side.

## Rendering, caches and repeated work retained safely

Public `/`, `/pricing`, `/templates`, template detail and raw preview pages remain static in the production manifest. No private dashboard was changed to static/ISR. Published customer sites remain dynamically checked: new edits, publishing state, custom domains and subscription/access checks have not been put in a shared cross-request cache.

Public website loaders already use React request memoisation for metadata/page reads. The Neon client already uses a reusable lazy module-level wrapper. Those patterns were retained rather than adding a second pool or stale authentication cache. No Server Component-to-self HTTP refactor was needed for the inspected paths.

Full offline tenant synchronisation still loads complete customer/billing/report arrays, with existing tenant/session authorisation. It is not safe to arbitrarily paginate/truncate that snapshot without adapting offline reporting and mutations. This remains a measured follow-up if route usage identifies it as a bottleneck. Public article and existing support list bounds remain in place; this change does not claim to paginate every private list.

Account balances, invoice settlement, payment verification, webhooks, sessions, role checks, consent and private responses remain uncached. Main only caches eligible public feeds/pricing for regeneration, not the Business checkout or payment result. Security-sensitive paths have not been moved into `after()` or background work to hide CPU.

## Cron and analytics review

`vercel.json` retains `/api/cron/daily` at 07:00 UTC and `/api/cron/domains` at 08:00 UTC. Existing consumers use leases/row locking (`FOR UPDATE SKIP LOCKED`) and idempotent keys. Renewal fail-safe overlap was retained intentionally; deleting a job without operational evidence could drop reminders or reconciliation.

No cron route was invoked in testing and no schedule was added. Verify Vercel legacy Cron Jobs, Schedules and any external triggers are not independently scheduling the same handlers. Keep `CRON_SECRET` in secure environment settings. Do not disable a working schedule until its replacement is verified.

Game feed polling already pauses hidden tabs. Local animation clocks do not invoke server functions. Analytics remains event-driven/consent-controlled and chatbot interaction remains functional; no business events were dropped to reduce invocation counts.

## Validation

- Final production build passed; TypeScript passed during the build. Used `NODE_USE_ENV_PROXY=1 npm --ignore-scripts run build` to avoid the normal prebuild hook, which runs database migrations. No migration was required for these changes.
- Targeted ESLint: zero errors; two warnings on deliberate support request-generation counters read during cleanup (these are numeric counters, not DOM refs).
- Five new CPU tests pass: route bootstrap scope, hidden-tab/overlap/cleanup/focus behaviour, bounded failure retry cadence, feature response cache/CORS/no-cookie behaviour, and matcher exclusions/protected-route retention. Both apps use byte-identical polling helper source.
- Support/review/partner/auth-security group: **20 passed** using isolated PostgreSQL/PGlite/mocks, including consent, permission enforcement, handoff and notification-subscription authorisation.
- Billing/domain/editorial/CPU group before the additional matcher test: **57 passed, 1 failed**. Passed cases cover exact verified-payment values, forged/wrong-tenant rejection, webhook signatures/retries, settlement idempotency, bank readiness, refunds and subscription lifecycle. No live charge was created.
- The one failure is the existing `tests/editorial.test.mjs` navigation assertion at the writer role test: expected only `/admin/content`, actual also `/admin/knowledge`. `src/lib/admin-permissions.ts` and that assertion were unchanged. Permissions were deliberately not changed as part of CPU work. Public article projection/privacy/pagination tests passed.
- Browser checks against the local production app: partner/affiliate login pages each return 200; owner login/signup each have a visible H1, `noindex`, and retain `?template=lumi-atelier`. Unauthenticated `/business` returns to owner login and `/admin` to team login.
- With a simulated stored live-owner session but no real auth cookie, the public raw preview `/template-canvas/lumi-atelier` rendered 200 and made **zero private Server Action requests**. No production customer was signed in or edited.
- Feature success/error headers and both allowed CORS origins verified with mocked database responses. The local runtime without proxied DB setup returned 503; all three cache-control layers correctly said `no-store`. Live successful CDN hits still require post-deployment observation.
- Main companion build/browser checks verified public metadata/H1 output at desktop and mobile widths and a mock article update through ISR (MISS → HIT; updated content after expiry/regeneration).

## Remaining limitations and next authorised deployment

No authenticated production/staging mutation session, live tenant UI payment checkout or Vercel distributed-cache measurement was performed. Security/payment assertions use existing isolated tests. Validate a non-charge sandbox/staging account's edit, publish/unpublish, balance refresh and support reply after the next approved deployment. Do not generate a live charge just to test performance.

No Vercel memory/timeout/Fluid toggle changes are needed. On an authorised deployment, inspect `/api/public/features` cache headers, CORS for both Main origins, and repeated-request `x-vercel-cache`. The local Next server cannot prove Vercel cache hits or CPU reduction. Main's navigation proxy still executes even when its destination page is cached.

## Before/after measurement plan

Compare seven complete matched days before and after an authorised deployment, excluding build/warm-up activity and recording traffic/campaign/bot differences. Measure Main and Business separately, grouped by public pages/API, proxy, dashboard actions, payments/webhooks and cron.

Record total **Fluid active CPU milliseconds**, **function invocations**, **HTTP requests including CDN hits**, cache hit ratio, error rate, latency and DB reads where available. Calculate CPU ms/invocation and CPU ms/1,000 HTTP requests alongside totals. Compare visible-tab activity for polling workloads. Confirm cache freshness, successful/failed sandbox payments, tenant isolation, mutation refresh and cron completion before concluding savings. Do not interpret lower total CPU during lower traffic as an optimisation result.
