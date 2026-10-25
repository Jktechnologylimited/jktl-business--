# JKTL Custom rollout

## Implemented central architecture

`035_custom_projects.sql` adds Custom clients, many projects per organization, secure invitations, independent service agreements, invoices, support, short-lived CMS grants, a notification outbox and audit. No production client database URLs or copies of website content are stored centrally. Deployments, content schemas and databases stay with the individual applications. No existing website is migrated/rebuilt by this schema.

Business owner: `/business/custom`. JKTL owner admin: `/admin/custom-projects`. Other admin roles and business staff cannot use these actions. Main: `/products/custom-websites` (JKTL Custom), `/products/managed-services`. Existing template plans are unchanged.

## Pilot onboarding (no bulk invitations)

1. Create the client using their real owner email. Existing owners retain their user/organization/password; if multiple owned organizations exist, provide the explicit organization ID. New clients receive a random unusable password, never emailed. Account creation sends no invitation.
2. Attach one or more project URLs, customer-visible scope, configured analytics URL if available, optional owned domain asset and CMS callback where integrated. Never enter DB URLs, private dashboards or secrets into customer-visible text.
3. Configure services with real contracted prices, discounts, start dates and intervals. Hosting descriptions must say what JKTL's fee covers. Maintenance and third-party costs should be separate. Domain renewals use the domain marketplace and actual registrar expiry, not an unverified Custom recurring item.
4. Test using a permitted pilot account. Mark a project LIVE and confirm the configured pilot ready before sending **one individual invitation**. Invitations are hashed at rest, expire after 48 hours, invalidate prior links, and work once. Failed email attempts are invalidated and can be resent within rate limits. New clients set a 12+ character password; existing clients must sign in to the invited account and keep their password. Activation verifies email possession. Existing owners do not receive a reusable password-reset takeover link.
5. Sign in through `/login?next=custom`, review projects, service proposals and support. Existing CMS and analytics links are enabled only if configured; unintegrated CMS access remains disabled. No fake “13 connected” counter or sample client is seeded.

The recommended K.K. Ubani & Co. pilot is **not connected automatically**: its repository, configured application access and approved customer identity are required. Do not send the rest of the customer invitations until this pilot is verified.

## Custom billing

Agreements are PROPOSED until an active customer owner explicitly accepts the exact revision, scope, amount, discount and interval. Accepted prices are immutable in the UI: pause/cancel future billing and propose a new agreement for approval if pricing changes. **Automatic charging is disabled**. This implements recurring invoicing with customer-initiated one-off payments, not a stored-card subscription mandate; no recurring card authorization is inferred from signup or agreement acceptance.

At most one unpaid period invoice exists per service. The next period is invoiced up to 14 days ahead and advances only after verified payment; historical debt is not generated in a single unbounded sweep. Late periods advance one interval at a time. Payment uses the existing Paystack secret and signed webhook, a unique Custom reference, exact NGN amount/customer metadata verification, and a unique provider transaction ledger. Unknown initialization is never blindly repeated; support/verification is required. No admin “mark paid” control. The invoice list includes receipt reference/date for verified payments. Invoice/receipt/reminder notices run in the protected `/api/cron/domains` job, with retry leases/idempotency; upcoming reminders at 7/1 days and overdue at 7 days, subject to cron execution.

Pausing/cancelling stops future invoice generation; existing open invoices remain payable and need review. Automated refunds, pro-rated credits, dunning/suspension, saved-card recurring mandates and automatic collection are not enabled. Support handles disputed invoices and provider reconciliation. Do not claim these capabilities are live.

## CMS integration

Reusable server adapter and contract: `packages/custom-cms/README.md`. Per-project API keys are generated once and stored **hashed** centrally; put their value only in the independent application's secret environment. CMS launch requires active customer, pilot ready, LIVE project, configured callback and confirmed CMS test. Business issues a hashed one-use code valid for 90 seconds; the application exchanges it server-to-server. Revoked membership/project/key blocks new launches/exchanges. The independent application must map explicit identities to its own CMS roles, establish a short secure session, validate content, write an audit entry and revalidate its own content cache. Existing CMS session revocation remains the individual site's responsibility.

Only content read/write/publish scopes are offered. No universal school, finance, ticketing or site admin permissions. There is no cross-project schema assumption. No embedded CMS is claimed until its frame/CSP/session model is reviewed. Code/configuration deploys remain GitHub → Vercel; content publication can update a database and revalidate without redeployment.

## Environment and rollout checks

Existing Business DATABASE_URL, Paystack secret/webhook, Resend sender/key, NEXT_PUBLIC_APP_URL and CRON_SECRET are reused. Migration 035 follows 034 and is included in deployment prebuild; run `npm run db:migrate` where appropriate. Back up normal business data. No website database secret is needed centrally. Website adapter secrets are documented above, not browser variables.

`node tests/custom-projects.test.mjs` runs actual migration/SQL against PGlite: readiness gating, invitation hashing/expiry/use and existing account preservation, accepted price snapshots, no implicit charging, exact payment verification/idempotence, tenant/admin boundaries, CMS key rotation/grant expiry/replay and durable notification retries. Provider/email calls are mocked. This does not verify a live client CMS, production mail, or real Paystack collection.

Further rollout is project-by-project: connect the permitted pilot repository, test real CMS permissions/publication, then configure each remaining client and send individual invitations. Publish only approved case studies and testimonials; none are fabricated or auto-published by this change.
