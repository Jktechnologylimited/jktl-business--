# Managed website content performance review — 15 November 2026

This review covers the prepared release for `jktl-business--`. Implementation and
local verification made no live charge, email, cron execution, production
migration or client-repository edit. The owner authorized deployment on
15 November 2026; check the matching GitHub/Vercel deployment for release status.

## Evidence and scope

The supplied production observation covers 12 hours: 699 invocations, of which
283 (40.5%) were the custom website content endpoint, with 15 seconds of active
CPU. Overall P75 was 100 ms, overall errors 0.6%, and `/business` had two failed
requests out of three. These are user-supplied measurements, not independently
queried Vercel telemetry. This short window cannot identify the cause of the
monthly quota exhaustion. No measured production savings are claimed.

Source confirms the old public content route performed a project eligibility
query, a distributed rate-counter write, then a content read including draft and
audit JSON. It returned HTTP no-store, so each render's uncached central request
repeated all three database round trips. The Neon wrapper in `db/client.ts` is
already lazy and reused; another database client/pool was unnecessary.

Installed Next.js is 16.4.2. `cacheComponents` is not enabled. The installed
`unstable_cache`, `revalidateTag` and Route Handler documentation was read. The
existing supported Data Cache API avoids enabling Cache Components across the
application. There is no framework upgrade or new dependency.

## Changes

| Files | Result |
| --- | --- |
| `src/lib/custom/site-store.ts` | Public reads select only `published`; draft/admin reads retain revision, draft, published and audit. A successful publish expires relevant tags after its database write. |
| `src/lib/custom/published-site.ts` | A single SQL statement checks current LIVE, managed-CMS, non-billing-only eligibility, reads project/content revision metadata and increments the existing distributed rate bucket. Only the subsequent published snapshot is cached. |
| `src/lib/custom/managed-site.ts` | Shares the existing public eligibility predicate; owner/session/scoped editing checks are preserved. |
| `src/lib/custom/site-cache-tags.ts` | Immediate tag expiry using `revalidateTag(tag, { expire: 0 })`, with project and organization tags normalized as UUIDs. |
| `src/lib/actions/managed-site-actions.ts`, `custom-project-actions.ts` | Expire tags after successful CMS configuration, project/status/configuration updates, CMS key/test changes and client-readiness changes. Existing authorization, optimistic revisions and audit calls remain. |
| Public managed-content route | Preserves successful `{ published: object \| null }` JSON. Ineligible/missing/invalid IDs are 404, rate exhaustion is 429 with Retry-After, infrastructure/version-race failures are 503. All are HTTP no-store at browser, generic CDN and Vercel CDN layers. |
| `src/lib/domains/store.ts` | Exposes the unchanged fixed-window key calculation and a typed limit error. Other callers retain the same limits, bucket storage, expiry and user-facing error message. |
| `src/lib/public-response-cache.ts` and four public routes | Strict 60-second CDN success caching and explicit no-store errors; no browser freshness window or stale-while-revalidate extension. See route table below. |
| `.env.example`, `packages/custom-cms/README.md` | Optional bounded cache TTL and shared consumer guidance, using existing infrastructure. |

## Cache freshness, isolation and revocation

`JKTL_MANAGED_CONTENT_REVALIDATE_SECONDS` defaults to 300; accepted integer range
is 30–3600 seconds. Invalid values safely use 300. It applies only to the public
snapshot Data Cache, not authentication, permissions, payments or billing.

Keys include project UUID, organization UUID, project revision and content
revision. Only public fields enter the cached value. Current admission is
outside the cache on **every** request. A project suspension, CMS disablement,
billing-only change, deletion or change of organization is therefore observed
on the next authoritative admission after commit, even when old snapshot data
remains physically cached elsewhere. An already admitted in-flight request can
finish; no new five-minute revocation grace period is introduced.

Publish writes both content and its revision atomically, then expires tags.
The next request that sees that committed revision uses a new key, providing
freshness even if an older in-flight cache fill completes after invalidation.
A miss checks the expected content revision; a publish racing that read yields
an uncached 503 rather than caching a mismatched snapshot. A draft save changes
no published fields and does not expire public tags; it can cause a new
revision-key lookup that still returns the same published content.

The database revision key is also a safeguard against missed application tag
invalidation during versioned administrative updates. Direct SQL imports must
increment the appropriate revision and use the normal invalidation path; an
unversioned direct edit is not a supported publishing operation. No project
ownership-transfer UI/API exists in the inspected code, and none was added.
The organization key and composite FK prevent reusing content from an old
organization if an authorized transfer is implemented separately.

Concurrent snapshot reads coalesce within one running instance, with at most
128 in-flight keys retained. Next's shared Data Cache handles normal reuse
between requests. This does not claim a distributed stampede lock: separate
cold instances may each perform a read. Admission and rate counting are never
coalesced. Failed reads are not cached, and database admission failures never
fall back to an old cached snapshot.

## Database round trips

These counts were asserted against isolated PostgreSQL/PGlite using the actual
SQL and an explicit test cache. They count SQL requests/round trips, not all
logical table/index operations or measured Neon billing units.

| Representative request | Before | After |
| --- | ---: | ---: |
| Eligible public read, cold cache | 3 | 2 |
| Eligible public read, warm cache | 3 | 1 |
| Eight concurrent eligible cold reads in one instance | 24 | 9 |
| Suspended/disabled/missing valid project ID | 1 | 1 |
| Invalid UUID | 0 | 0 |
| Exhausted project rate bucket | 2, incorrectly returned as 404 | 1, HTTP 429 |

The admission CTE still reads eligibility/revision metadata and performs one
atomic rate-counter write per admitted attempt. It consolidates those operations
into one round trip; it does **not** eliminate the write. Published reads no
longer transfer/parse private drafts and audit arrays. The content route still
invokes a function; internal data caching alone does not remove that invocation.

## Rate limits and cleanup

The existing project-wide limit remains 1000 requests per 60-second fixed window,
using `domain_rate_limits`. It is shared across instances. Uppercase UUID requests
normalize to the same project bucket instead of creating case variants. A denied
request does not load public content and receives a bounded Retry-After value.
Unknown projects do not create rate buckets.

Existing `/api/cron/domains` maintenance deletes expired buckets; each bucket
expires after two window lengths. No request-time sweeping, additional cron or
new storage service is added. If hosting/cron is paused, cleanup pauses too; check
the existing maintenance execution history after resuming. The table has its
existing primary key, with no speculative new index without retention/size data.

Use available Vercel Firewall/rate-limit/bot rules to reject abusive traffic
before function execution where the current plan supports it. Inspect rule
availability and traffic first; no paid service or dashboard rule was enabled.
Database rate limiting protects the origin but still incurs origin work.

## Other public endpoints

| Route | Treatment / freshness |
| --- | --- |
| `/api/public/features` | Existing 60-second CDN cache, cosmetic public projection, CORS/Vary and no-store 503 retained. |
| `/api/public/domain-prices` | Existing CDN eligibility retained; replace 60-second stale extension with a strict 60-second CDN lifetime. |
| `/api/public/email-plans` | Public/default plans only; CDN 60 seconds, existing apex CORS retained. No organization override is requested. |
| `/api/public/transaction-fees` | Public display schedule only; CDN 60 seconds, browsers must revalidate. Errors are 503/no-store. Actual quote/checkout/payment logic remains uncached. |
| `/api/publications` | Published/time-eligible, sanitized article/list query with existing pagination. CDN 60 seconds; invalid query, missing article and failures are no-store. |

Success Cache-Control is browser `max-age=0, must-revalidate`; dedicated generic
and Vercel CDN headers set `s-maxage=60`, with no stale extension. Catalogues or
withdrawn/changed public articles can remain visible through that CDN for up to
60 seconds. No manual CDN purge is claimed. Existing consumers' additional
caches can add their own freshness window. Checkout continues to validate current
prices, revisions, eligibility and payment state directly from authoritative
data, regardless of any public catalogue response. Private responses are not
placed in these caches.

## Consuming websites and dashboard reliability

The only managed-content consumer identified in the available client repositories
is `client-integrations/kkubani-pioneer`. Its server-only `businessStorage` fetch
uses no-store, an 8-second timeout, omitted credentials and rejected redirects.
`publishedSite = cache(publishedHomepage)` shares the result between the root
layout and individual server pages within a render. There is no browser polling
of this endpoint. A fresh navigation/SSR render can make a new central request;
link prefetch/build rendering can execute the same server loader. Static media
delivery is separate. Other inspected Custom Portal clients use their own CMS
and the authenticated billing/support integration, not this managed-content API.

The SDK README documents this shared integration pattern. No client source is
automatically edited. Central invalidation cannot purge an independent client's
rendered HTML or its own Data Cache. The existing K.K. Ubani source-default
fallback on central failure remains; central CMS revocation does not shut down
that separate deployment. Opting a consumer into HTML/ISR caching needs a
separate agreed revocation window and client invalidation before rollout.

No authenticated Vercel runtime logs are available here. `/business` is a client
dashboard over the existing tenant store, not the custom CMS endpoint. Its
server snapshot action already catches DB failures; bootstrap hydration is
guarded against duplicates. Root layout has no request-time cookie/header read.
The middleware already avoids database host lookup on JKTL's own reserved hosts.
Administrative links use normal Next Link defaults; the supplied three-request
sample does not establish that their prefetching caused errors or significant
CPU. No speculative middleware, prefetch, authentication or dashboard refactor
was made. Retrieve the two failed requests' timestamps, deployment SHA, HTTP
statuses and error fingerprints from Vercel logs before attributing a cause.

## Validation and release

- Production `next build --webpack` passed, including TypeScript and all 582
  prerendered pages. Managed content and public catalogue/feed APIs remain
  dynamic handlers; their explicit Data/CDN caches provide the reuse. `/business`
  remains a static, non-personal shell with client authentication/bootstrap; no
  tenant data was made static. The standard Turbopack build command is unchanged;
  local validation uses Webpack because this environment's Turbopack CSS workers
  previously failed to bind their socket.
- Standalone TypeScript passed. Targeted ESLint for every performance source and
  changed test file passed with zero findings. Full-repository ESLint was run and
  reports 122 errors and 17 warnings outside this patch, largely CommonJS browser
  fixture `require()` imports plus the existing apostrophe in
  `partner-domain-order.tsx`. Those unrelated files/configuration were not changed
  to make the performance patch appear green.
- Full existing suite plus the new SQL/cache performance tests: **91 of 95 test
  files pass; four fail**. Direct reruns identify two previously observed
  `company-finance.test.mjs` fixture assertions (7000 vs 17000 cost; 0 vs 1 stage),
  `languages-domains-upgrades.test.mjs` omitting `/tools/seo-checker` from its Main
  navigation allowlist, and two paired-repository byte/hash assertions in
  `occasion-template.test.mjs` and `website-templates.test.mjs`. The latter reflect
  the pre-existing held Business `process` → `processSection` build fix differing
  from Main. None is in the performance path; no finance/template/navigation
  behaviour or unrelated repository was modified to address them.
- The separately added `managed-content-next-cache.test.mjs` also passes. It uses
  the **installed Next.js Data Cache implementation** in a force-dynamic route
  context with isolated in-memory backing storage, proving framework serialization,
  reuse, version/organization key separation and rejected-callback behaviour.
  The SQL tests use PGlite and an explicitly labelled test cache for publication,
  drafts, tenant separation, suspension/deactivation, rate limits, errors,
  invalidation, TTL and concurrent misses. They are not live Vercel measurements.
- Local production HTTP checks: `/`, `/pricing`, `/help/support-ai`, `/login`,
  partner/affiliate login and `/business` return 200. Protected team structure
  redirects 307 to team login. A 390px Chromium browser navigates `/business` to
  login without a client crash. No signed-in production account was exercised.
- With database/provider credentials removed, invalid managed project IDs return
  404; a valid ID with no DB returns 503. Catalogue, publication and feature
  failures explicitly return no-store at all three cache layers and reveal no
  database details. The unapproved public fee display returns its compatible
  `{ approved: false }` body with the 60-second CDN headers. Live CDN hit ratios,
  signed-in `/business` errors and real Neon operation/CPU changes require
  post-review deployment verification; no runtime logs were available.

All database tests use isolated fixtures; the complete suite was run without
production credential variables. No live registrations, payments, customer edits
or notifications were used as tests. The production build bypassed the prebuild
hook, which would execute real schema preparation when a database is bound.

## After-review measurement plan

1. Retain a 12–24-hour baseline and then compare equal periods with comparable
   traffic, bot traffic, weekday and deployment activity. Separate the restored
   hosting/quota period from stable traffic; do not treat outage traffic as a
   performance baseline.
2. In Vercel Observability/Usage, filter this project and deployment. Record total
   active CPU, invocation count and total CPU/invocation; also group by the
   managed-content route and the five public APIs. Track P75/P95 duration, error
   codes and 429 counts alongside CPU. Do not add route CPU percentiles to derive
   totals or treat average latency as CPU.
3. For public catalogues, compare first/repeated requests using `x-vercel-cache`
   and response age where exposed, preserving identical URL/Origin. Expect CDN
   hits to avoid origin invocations. Dedicated Vercel CDN headers may be consumed
   by Vercel and not appear in the browser's response.
4. For managed content, expect HTTP no-store and continuing origin invocations.
   Compare Neon query/operation volume and sampled function CPU per request for
   warm/cold traffic; do not infer an exact saving from the SQL-round-trip table.
   Count the retained rate-counter writes separately from published reads.
5. With an approved test project after deployment, verify draft saves remain
   private, a publish appears on the next request, disable/suspend denies the next
   request, and re-enable restores only the correct organization's snapshot.
   Then verify the independent website's actual render/cache/fallback behaviour.
6. Review the `/business` error fingerprints and the existing domains cron's
   cleanup execution history. No extra cron, hosting plan change, Fluid toggle,
   function timeout or memory change is required by this patch.

The owner authorized this release after reviewing its scope and validation
limitations. Production verification must still check hosting/quota availability.
These optimizations cannot lift an exhausted Vercel allowance.
