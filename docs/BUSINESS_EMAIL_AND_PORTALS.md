# Business Email, feature badges and programme portals

## What changed

Business owns the editable email catalogue, organization price overrides, email orders, verified-payment records, service metadata, mailbox allocations, DNS instructions, support, renewal notices and audit. The application never creates an inbox or stores messages/mailbox passwords. Manual provider setup is recorded by an administrator. Existing Business organizations, owner permissions, Paystack gateway, programme authentication/commission ledger and Resend delivery are reused.

Main promotes **JKTL Business Email**, reads the public retail catalogue from Business, and uses the same live feature registry for NEW badges. Its footer has Product, Solutions, Resources, Support and Company navigation, plus the existing industries, contact details, signup link, social links, legal links and CMS-added footer links. Case-study cards animate with Framer Motion and respect reduced-motion preferences.

Admin and affiliate dashboards use a responsive navy/gold workspace with active navigation, account identity and a mobile drawer. Navigation remains capability-filtered; every protected action still enforces server authorization. Partner sign-in/applications have their own public routes while reusing existing programme sessions and hashed passwords.

## Routes and files

| Area | Routes | Main implementation |
| --- | --- | --- |
| Email marketing | Business `/business-email`, Main `/products/business-email` | `components/business-email`, `src/components/business-email/email-landing.tsx` |
| Customer email | `/business/email`, `/email-terms` | `src/lib/business-email`, `src/lib/actions/business-email-actions.ts`, `src/components/business-email/email-dashboard.tsx` |
| Email administration | `/admin/business-email` | `src/components/business-email/email-admin.tsx` |
| Feature controls | `/admin/features` | `src/lib/actions/feature-actions.ts`, `src/components/features` |
| Public catalogue | `/api/public/email-plans`, `/api/public/features` | Explicit retail/registry projections; no provider costs, credentials, customers or private quotes |
| Partners | Main `/partners`; Business `/partners/apply`, `/partners/login`, `/partners`, `/partners/playbook`; admin `/admin/partners` | `src/lib/actions/partner-actions.ts`, existing affiliates DB/session, `src/components/admin/partner-manager.tsx` |
| Dashboard design | Existing admin and affiliate dashboards | `src/components/admin/operations-frame.*`, guarded layouts |
| Shared notifications | Existing `/api/cron/domains` | Email, domains and Custom jobs are independent Promise.allSettled operations |

Migration **036_email_features_partners.sql** is additive and included in deployment prebuild. It creates email plans, negotiated quotes, services, mailbox records, orders, requests, audit/outbox, the feature registry/badge history, and adds partner programme/terms fields to affiliates. No existing mailboxes are migrated or modified. Seed inserts do not overwrite admin edits on later deployments. The full migration runner remains `npm run db:migrate`.

## Proposed catalogue and launch gate

Defaults are Starter ₦25,000/year (1 mailbox, 5 GB), Team ₦65,000/year (3 mailboxes, 5 GB each, recommended), Business ₦120,000/year (5 mailboxes, 5 GB each), and Custom (10+ mailboxes, assessed storage and a quote). These are editable database configuration, not frontend price constants. No monthly default, discount or automatic debit is invented.

All plans start with **checkout disabled**. An owner admin must record procurement costs and separately confirm paid licensing, resale/provisioning rights and feasibility of advertised features before enabling purchase. Public visibility, purchase permission, recommendation and enabled status are separate controls. NEW does not grant purchase access. Do not enable paid resale using free provider accounts.

Owner admin can edit names, descriptions, prices, billing periods, mailbox/storage allowances, features, recommendation, availability, purchase gates and reminder days. Plans may be hidden from the public but offered to a specific organization via an override. The customer sees the negotiated price and customer-visible agreement/fee breakdown before consent; the note is snapshotted on the order. Existing order amounts, features and service periods retain their agreed values. Optional setup, management, migration or support amounts can be included in an explicitly reviewed negotiated quote. There is no automatic extra-fee collection. A fee recorded against a linked legacy service is metadata only and requires a separately accepted agreement/payment authorization before collection.

## Customer ordering and payments

An active business owner selects a plan, an owned or externally registered domain, and unique preferred mailbox names within the allowance. Domain purchasing links to the existing domain flow; email ordering does not assume DNS control or rebuild registration.

The backend checks plan/quote revision, purchase readiness, mailbox limits and exact versioned terms consent, then snapshots price/features/scope. PostgreSQL prevents duplicate in-flight domain orders. Initialization claims a reference once; ready checkout is reused and unknown initialization requires status review instead of a second charge. Domain and email checkout are one-off payments; email service periods renew through a newly reviewed payment, not stored-card auto charging.

Only server-to-server Paystack verification can confirm payment. Reference, integer NGN amount, provider transaction uniqueness, owner email, domain and metadata must agree. Email webhooks commit before acknowledgement and before legacy subscription receipt handling; failures return 503 for retry. A callback does not activate email. Payment creates a service/setup request, ownership token, requested mailbox records, audit and notification. Allocated records during setup are reservations, not evidence the provider has created a mailbox.

Unpaid cancellation requires provider-confirmed failed/abandoned status. Pending/unknown transactions remain protected. A late charge after cancellation is recorded as PAYMENT_REVIEW, creates no email service, and enters the administrator review queue. Review the actual provider transaction/refund through Paystack before any resolution; do not treat a late payment as permission to provision a second service. Gross payment metrics are not net revenue/refund accounting.

## Manual Zoho provisioning runbook (administrator only)

1. Open the verified order in Admin → Business Email. Check organization, domain, allowance, requested mailboxes and agreed scope. Do not provision an unpaid order.
2. Customer adds `_jktl-email.<domain>` TXT with `jktl-email-verify=<token>` and verifies it from Business Email. The server checks actual DNS. Existing linked services require an explicit administrator ownership attestation instead.
3. Procure/configure an appropriately licensed **paid Zoho Mail service** for paid orders. Record the internal provider plan and reference. Do not use a free 5 GB account as the paid resale licence. No speculative provider API is called.
4. Review existing DNS and obtain permission before changing anything. Record the actual provider-issued MX, SPF, DKIM, DMARC and verification records. No generic provider DNS targets are invented and no records are overwritten by JKTL code. SPF/DKIM/DMARC instructions represent TXT values; MX includes priority.
5. Create the requested mailboxes at the provider. Test sending and receiving, verify webmail and secure account activation/password setup. Record actual start/renewal dates matching the purchased period; admin datetime inputs use Nigeria/WAT.
6. Mark Active only after ownership, licence, DNS and send/receive checks pass. Record a customer-visible note without internal credentials. Activation queues a service update notification. Public pages carry JKTL branding; provider disclosures remain in service terms and internal records.
7. For additional/removal/alias/upgrade/migration/password-reset/support/billing requests, perform the authorized provider operation first. Record confirmed mailbox allocation changes within the allowance, and reply to the request. Do not mark an unperformed provider operation completed. Secure password reset stays with the provider; never store/email plaintext passwords.

## Existing services and renewal

Link an existing owner organization/domain, actual mailbox addresses and quantity, storage allowance, internal provider plan, free/paid licence type, current status and optional renewal date/management-fee record. Linking makes no provider changes, purchases or charges and does not force migration. Duplicate domains/addresses are rejected. A linked free account is not represented as a paid hosting subscription.

Customer sees its own service status, allowances, requested/allocated addresses, available slots, verified ownership, DNS instructions, actual period dates, billing history/receipts, support and configured secure access links. No live storage usage is claimed. Every lookup/action is scoped to the authenticated organization and active owner role.

Paid ACTIVE services within 45 days before the recorded expiry may request renewal using current reviewed pricing. Expired/free/otherwise ineligible services use billing support. Renewal payment does not advance expiry; administrator confirmation must match the recorded prior period and paid duration. Mailbox changes are requested separately before renewal. Pausing or an overdue JKTL invoice never automatically deletes/suspends a mailbox.

Reminder days are configurable per email plan (unique integers 0–365; blank disables). Defaults: 30, 14, 7, 0 days before actual renewal in Africa/Lagos. Legacy linked services without a plan use these defaults. The existing protected daily job at 08:00 UTC / 09:00 Nigeria queues notices once per service+renewal+day, leases sends for five minutes, uses provider idempotency keys and retries failures. Monitor outbox failures/batch capacity; no automatic suspension job is added.

## NEW badge controls

Owner/editor admins can register features and enable/disable NEW, set Nigeria/WAT start/expiry dates, clear dates, preview the badge and inspect actor/timestamp history. Revision conflicts require reload. Defaults are off. Expired/future badges are filtered by server time. Turning a badge off never disables the feature or checkout.

The reusable FeatureBadge component reads the centralized public registry and refreshes every 30 seconds and on window focus. It appears in supported navbar/dropdown items, Business sidebar/More cards, Main feature/product pages and homepage feature cards, and the email product/service entry points. Route aliases connect Main and Business labels to one registry key. Public responses contain no provider/customer data. Failure defaults to no badge. Registry entries include Business Email and existing website, domain, Custom, games and common tools; none are automatically marked NEW.

## Partners and affiliates

Main now sends new applicants to Business `/partners/apply`, which captures a secure password and company/specialism/client-volume details into a pending **partner** programme account. `/partners/login` opens only after approval and confirmed negotiated terms. Admin → Partners shows the application and requires a commission rate and written qualifying-purchase agreement before approval. Partners start with zero bonus/commission defaults; no affiliate tier is silently promised. Approval uses the existing notification infrastructure with a partner-specific sign-in link. Suspension invalidates usable sessions through the existing active-status check.

The existing affiliate portal and ledger remain in place; affiliates retain their configured terms. Partner payouts/qualifying commissions use that ledger, and current automated qualification remains the existing supported website payment flow. Other products require an explicitly supported agreement/reconciliation process; no email/domain commission is invented by these changes. Pending accounts cannot be promoted through the generic suspend/reactivate action.

The former Main partner form stored enquiries, not authenticated accounts. Those historical enquiries remain in Main's existing inquiry storage. Configure the same private `JKTL_PARTNER_BRIDGE_SECRET` (32+ random characters) in both Main and Business deployments to review them through the read-only `/api/internal/partner-applications` bridge. It returns only consented partner enquiries and requires constant-time checked server authentication; it is never called with browser-visible credentials. Admin → Partners can explicitly import an enquiry as a pending account with an unusable random password hash and zero commission defaults. Existing programme emails are not overwritten. After terms are agreed and approval is recorded, imported applicants are directed to the existing secure password-setup/reset flow; no reusable password is emailed. No legacy account is silently activated. Previous enquirers can also create a portal account using the same email. This runtime has no production database access or bridge secret to import actual applicants.

## Environment, verification and rollout

Reuse existing `DATABASE_URL`, `PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, verified `RESEND_FROM_EMAIL` and `CRON_SECRET`. Keep the existing signed Paystack charge.success webhook. No Zoho API keys, mailbox passwords or new public secrets are required. The optional legacy partner enquiry bridge uses `JKTL_PARTNER_BRIDGE_SECRET` in both server deployments. Main needs outbound access to Business's public email-plan/feature APIs. The feature endpoint permits the Main origin for public browser reads; neither endpoint accepts price changes.

Required launch actions: apply migration 036 in the actual Business deployment, check Resend/cron/webhook configuration in test mode, configure genuine provider licence/cost/resale approvals, test a permitted pilot domain, then deliberately open checkout. NEW is a separate marketing decision. Never provision real mailboxes or make live payments in automated tests.

Tests exercise actual PostgreSQL-compatible migration/queries using PGlite and mocked provider/email calls: disabled launch gates, editable annual prices, exact/duplicate/late payments, actual webhook retry paths, domain verification, paid licensing, provisioning, free-service linking, private pricing isolation, renewal snapshots, mailbox changes, tenant/admin roles, badge scheduling/history, partner pending/approval/login, private legacy-enquiry import and reminder retries. TypeScript, targeted lint, production builds and browser checks cover the new surfaces. Local passing checks do not establish live provider resale approval, actual mailbox activation, production migrations or email delivery.

## Actual client screenshots

Client repositories must be checked out in this runtime. A new cloud task with those repositories selected can mount them; exact GitHub URLs also permit an authorized clone where access is available. Then run each application with permitted demo/public content, capture desktop/mobile screenshots with Playwright, save them under Main `public/case-studies`, and reference them from the case-study catalogue. Public client URLs are another source when reachable. Do not capture private portals or customer data. Environment selection changes have not mounted the client checkouts into this running workspace, and repository listing is blocked here; project-name covers remain explicit artwork.
