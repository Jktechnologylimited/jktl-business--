# Growth completion — 8 November 2026

This supersedes the follow-on engineering list in `GROWTH_ACTIVATION_REVENUE.md`. It extends the existing applications and preserves customer sites, authentication destinations, billing authority, invoices, subscriptions, distribution agreements and notification settings. No production migration, push, deployment, real checkout or customer email has been executed during the hold.

## Onboarding

Industry → choose a free template in the existing gallery → business details → optional first service → existing editor → preview and free-address publication. Gallery preview links still open freely in a new tab. The gallery's optional selection callback stores the choice without publishing or creating a second site. Users who already chose a template proceed directly to business details; they do not need to choose again. Existing product intents (plans, domains, email, team/program invitations and support) retain their destinations and do not require an unrelated template choice. Back navigation permits deliberately changing a selection.

Phone, city and state remain saved through the awaited existing profile action. Failed saves keep the user in onboarding. The existing Business home checklist handles current draft, published and Custom states; upgrade and public links remain visible. Logos and complete website content are edited in the existing editor rather than a second onboarding CMS.

## Conversion tracking

Main now offers **Privacy & optional journey analytics** near its footer. Tracking is off by default. Explicit permission creates a 30-day first-party browser identifier through Business's `/api/growth/visit`; no API key is exposed. Do Not Track / Global Privacy Control block collection. Turning tracking off stops future collection and requests removal of the journey; a failure is disclosed with a retry control. Signup linking also checks the consent cookie and privacy headers.

The endpoint has an exact origin allowlist, credentialed CORS, a strict public-path allowlist, a small request limit, shared hashed-IP rate limits and secure HttpOnly identifier cookies. It stores public paths without query strings, one row per browser identifier/path/WAT day, and no raw IP addresses, page queries, form contents or full referrer URLs. Signup uses the server-created organization ID and consumes a valid, unassigned, unexpired identifier. Public callers cannot supply an organization to attribute a conversion. Signup attribution is best effort and never prevents account creation.

Insights adds a first-seen consenting-browser cohort, with nested registration/selection/publication/paid milestone coverage through the report timestamp. These are not all visitors, distinct people or proof that events happened in that order (a customer can pay before publishing). Browser identifiers expire and are pruned by the existing daily sweep, so older cohort coverage is incomplete after 30 days. Aggregate saved reports remain available separately. Existing referral consent and first-touch commission attribution are unchanged.

## Recurring revenue and collections

The existing Insights/report model now has optional sections for covered company recurring revenue, extended gross collections, observed movements, consented conversion and evidenced acquisition costs. Older immutable report payloads remain readable. Existing website-only MRR/ARR remains separately labelled.

Covered company MRR includes:

- Active, unexpired website subscriptions matched to current verified payments; annual receipts normalized over 12 months.
- Active PAID-license Business Email matched to the latest paid, consented order, organization, service, plan, amount and period. Legacy free email is excluded.
- Accepted, active MONTHLY/ANNUAL Custom services, after their start date, with a fully settled current-period invoice and verified retained receipt evidence. ONCE services, unaccepted proposals, unpaid or mixed/mismatched invoices and expired payment coverage are excluded.
- Active legacy hosting with explicitly verified successful **live** NGN provider payment evidence matching the organization, amount and billing cycle. Signed webhook/verified callback paths capture future evidence without changing the payment or access result; a reporting-write failure logs a reconciliation warning. Team evidence controls can read-verify an old payment reference without charging the customer.

Potential overlap is excluded conservatively: Custom EMAIL is excluded where an evidenced Business Email subscription exists; Custom HOSTING is excluded where website/legacy hosting evidence exists; legacy hosting is excluded where an evidenced website plan exists. Excluded candidates are counted, not silently estimated. Other distinct Custom maintenance contracts remain separate services.

Extended gross collections combine existing verified receipts with reconciled legacy hosting, deduplicated by reference/provider transaction. Gross collections are before refunds, fees and tax; recorded risk is shown separately. Cash and open invoice balances do not become ARR. Reports remain unaudited. Older payment ledgers do not uniformly prove live/test mode; reconcile provider and bank statements before investor circulation. Missing source tables appear unavailable rather than zero and prevent daily financial snapshot capture.

## Observed churn and expansion

The existing daily sweep captures one append-only WAT-day snapshot of the covered recurring-service items. A database trigger prevents updating/deleting saved snapshots; repeated runs preserve the first capture for that day. The Team can capture a missing current day through Insights.

The report compares identical service keys on consecutive days only and charts net run-rate change. It reports new MRR, expansion, contraction and lost covered MRR. Missing days are skipped; no pre-installation churn or upgrade history is fabricated. These are observed changes in evidenced paid service run-rate, including expiry/coverage changes, not all-company customer churn or cancellation intent.

## Acquisition cost controls

Authorized Team members with `manage_team` can record NGN spend, referral account, spend date and a real evidence reference in the existing Insights screen. Incorrect records are voided with confirmation and the responsible Team member recorded; the historical record is retained. Duplicate active source/date/evidence references are rejected.

Source CAC uses recorded nonvoid spend divided by businesses whose first retained covered payment is in the selected WAT period, with existing first-touch referral attribution. Missing spend or a zero paying-customer denominator yields unavailable CAC. Unallocated spend stays separate. This is evidenced period CAC, not a claim that every marketing cost or attribution channel is covered. Data completeness and purchase lag matter.

## Event-driven customer engagement

Migration 075 adds durable event signals feeding **the existing lifecycle email queue**:

| Signal | Action |
| --- | --- |
| First observed publication | Review/share the published website and next steps |
| First chatbot enquiry | Review existing chatbot leads and organise follow-up |
| Website subscription payment failure | Review current subscription/payment history securely; contact support before attempting a duplicate payment |
| Exploring website plans | After a day, explain available upgrades if still eligible and marketing permission permits |

These share the existing lifecycle switch, pauses, mailbox cooldown, renewal-message deferral, preferences/suppression, provider idempotency keys, leases, bounded retries and uncertain-delivery human review. New publication/enquiry/payment messages are service notices; plan exploration is marketing and requires opt-in plus configured company postal details. No new sender or cron slot is created. The sender remains JKTL Business at notifications@mail.jktl.com.ng, with configured Reply-To settings.

Signal keys prevent duplicate first-event messages; event-purpose uniqueness does not consume an existing setup-reminder slot. Old signals are not backfilled, a newly paid plan cancels an unnecessary upgrade offer, a resolved payment failure cancels its queued warning, and an unpublished site cancels a stale publication message. Unresolved payment failures create a Team handoff after seven days; those handoffs close when the recorded failure resolves. First enquiries cover captured chatbot leads, not unverifiable email/telephone enquiries outside the platform. Email provider acceptance is not proof of inbox delivery.

The existing **Emails → Account Journey** scan queues signals without sending. Its event list shows the purpose, and the existing dispatch/review actions process them. No bulk email has been sent by this implementation or its tests.

## Reliability and operational verification

The existing authenticated, tenant-scoped website and billing paths are preserved. Tests cover ownership/staff restrictions, per-site metrics, invoice settlement, payment replay, refund/cancellation handling, publishing and new analytics security. Configured credentials are no longer presented as proof of live provider connectivity in Integration Health.

Insights now lets authorized Team members record concrete verification references for backup restoration, monitoring/alert routing, signed webhook delivery and the deployed scheduler. These are explicitly labelled Team attestations, not automatic provider-health guarantees.

`scripts/verify-growth-release.mjs` is read-only and refuses to run unless `JKTL_VERIFY_DEPLOYED=yes` is explicitly supplied. After an authorized deployment it checks required tables, actual eligible-account count (no hardcoded 21), lifecycle and snapshot freshness, unresolved mail review, dated operational evidence and representative public auth routes. It does not migrate, send mail, charge, publish, log in as a customer or restore a database. It prints no credential values.

## Release hold and the external checks

Migration 074 and 075, Main and Business changes must be released together through the normal deployment process **only after John says deploy**. Local builds skip the migration prebuild hooks. No production schema installation has been performed here.

The engineering for the previously listed pending items is implemented. Production verification remains release-dependent: apply the additive migrations, observe real milestone and recurring snapshots, inspect existing authenticated Insights and notification review screens, verify actual signed provider callbacks and scheduler execution, confirm alert routing, and perform/document a real backup restore in an isolated recovery environment. Provider credentials/configuration and a backup provider cannot be certified by a local build or a checkbox. Do not generate fake customer activity or financial data to fill these reports.

## Local validation

Both Main and Business production builds passed. Business used `npm --ignore-scripts run build`, so database prebuild/migration hooks did not run. Both TypeScript checks and scoped ESLint checks passed (Main's scoped check reused the existing Business ESLint configuration because Main has no local flat config).

The completion, activation, investor-report, website billing, lifecycle, invoice settlement, multisite and publishing suites passed: **49 tests, zero failures**. The tests use isolated PostgreSQL-compatible fixtures and mocked providers. They cover recurring evidence, receipt deduplication, movements, acquisition costs, authorization, physical snapshot immutability, signal delivery/suppression, consent and CORS controls, tenant isolation, payment handling and publishing.

Actual onboarding/gallery, checklist and revenue-chart browser fixtures passed at 1440, 390 and 320 pixels. Main consent/withdrawal/Do Not Track browser checks passed at the same widths with all requests intercepted. No real provider call, customer message or production analytics write was made by those tests. The deployed verification script remains unexecuted during the release hold.
