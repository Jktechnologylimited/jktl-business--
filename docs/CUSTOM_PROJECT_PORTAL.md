# Independent custom websites: billing, invoices and support

## Architecture and boundaries

JKTL Business is authoritative. This implementation extends `custom_projects`, `custom_services`, `custom_invoices`, `custom_audit`, `custom_outbox` and the existing `support_cases` engine. Independent websites retain their own source, deployment, customer database, login and store payments. No JKTL Paystack secret is required in an integrated client website. The only new package dependency in Business is `pdf-lib` for server-generated, branded PDF invoices.

The reusable Next.js interface and server SDK live in `packages/custom-portal`. Stick On Chic vendors the same package as a local file dependency so it deploys independently. Future UI/SDK updates should be copied or distributed as a reviewed package version; a change in Business does not silently update independent sites.

## Team controls

Use **Team → Custom Projects → Billing & Integration**. Existing project registration, client invitations, service agreements, repository/deployment references and CMS remain unchanged.

The new panel includes actual project/contract/renewal/ticket counts, outstanding and overdue totals, draft/issue/void invoice controls, project/customer/status/due-date filters, payment-attempt verification, explicit owner mappings, scoped key rotation/revocation and links to the existing support inbox. No fabricated revenue is displayed. Only verified payments enter invoice balances. Existing annual/monthly/one-time agreements and their prices remain intact; manually scheduled work is invoiced directly.

All these financial controls require the existing `manage_custom` capability. Support agents retain `manage_support` and assigned-case restrictions; they do not acquire billing administration. Issued invoices cannot be repriced, have dates changed or be reverted to drafts. Void an unpaid invoice with no checkout history and issue a replacement. A paid invoice cannot be voided. Changes and payment events are audited.

## Owners and server credentials

1. Register the project against its existing client organization. Preserve its stable UUID across deployments.
2. Ensure the client user is an active member of that organization. Use the existing secure, expiring invitation flow if needed; never email a password.
3. Map the independent website's **local owner user ID** to that member's email. Explicitly choose billing/invoice/payment/support scopes. An arbitrary local administrator does not gain access.
4. Configure the payment return path, usually `/admin/billing`. The callback origin comes only from the team's registered production website URL.
5. Generate a project key. It is shown once, stored hashed centrally and installed only in the client's private environment. Rotation revokes previous keys. Owner grants can also be revoked individually. Enable the integration only when ready.

Server requests include a bearer project key plus a signed local owner assertion: method, path/query, local subject, timestamp, nonce and SHA256 of the exact body, newline separated, HMAC-SHA256 signed using the project secret. Five-minute validity and single-use nonces prevent replay. Every call checks project state, active membership, owner grant, credential revocation and scope. Cookie-authenticated Business owners instead use their existing session with organization ownership and mutation-origin checks. There is no public invoice access token or second password system.

## API

All routes are under `/api/v1/custom-projects/{projectId}`. Responses are private/no-store. No CORS access or credentials are exposed to browser scripts; independent websites call through their own authenticated server proxy.

| Method | Path | Scope |
|---|---|---|
| GET | `/billing` | billing:read |
| GET | `/invoices`, `/invoices/{id}`, `/invoices/{id}/pdf` | invoices:read |
| POST | `/invoices/{id}/pay` | invoices:pay |
| GET | `/payments` | invoices:pay |
| POST | `/payments/verify` | invoices:pay |
| GET | `/support`, `/support/{id}`, `/support/{id}/attachments`, `/support/{id}/attachments/{file}` | support:read |
| POST | `/support`, `/support/{id}/replies`, `/support/{id}/attachments` | support:write |

Payment request body: `{ "amountKobo": 11960000 }`; omit to pay the next agreed instalment or outstanding balance. Verification body: `{ "reference": "jktl_project_..." }`. Ticket creation: `{ "subject": "...", "message": "...", "category": "BILLING" }`. Reply: `{ "message": "..." }`. Attachment: `{ "name": "proof.pdf", "body": "<base64>" }`. PNG/JPEG/WebP/PDF only, server magic-byte checks, 512 KB per file and 5 MB per ticket. Downloads require authorization and use attachment disposition. No blob service is introduced.

Business owners can access `/business/custom/{projectId}/portal` from their existing custom workspace. Team PDF downloads use `/api/admin/custom-invoices/{invoiceId}/pdf`; assigned support agents use the protected attachment route in the existing inbox.

## Invoices and Paystack

Version 2 extends existing invoices with immutable line items, invoice numbers, customer/project snapshots, NGN currency, issue dates, instalment schedules and paid totals. UI statuses include Draft, Issued, Partially Paid, Paid, Overdue and Voided. Monetary calculations use integer kobo. Existing version 1 invoices remain supported without changing their contracts or payment references.

`custom_invoice_payments` records each checkout and verified payment against the existing invoice. A unique reference and one pending checkout per invoice prevent duplicate starts. Unknown initialization results remain pending; there is no blind retry. Existing checkout URLs are reused only for the same amount. Successful transactions are verified through JKTL's existing Paystack server client, including reference, amount, currency, email, metadata, transaction ID and paid timestamp. The existing signed Paystack webhook delegates these references to the same verifier. Duplicate notifications do not allocate twice. No subaccount, client merchant key or automatic card debit is used.

Instalment schedules must total the invoice and respect agreed date order. The owner can pay the next remaining instalment or the full outstanding amount. Only full coverage marks Paid. Unexpected late/overpayments are retained as verified transactions requiring team review; they are not silently allocated. Confirmed provider refunds are retrieved server-side, deduplicated and deducted from paid totals; affected invoices are held for review. Dispute events hold the invoice for team reconciliation. Authorized team members can complete reconciliation with a recorded evidence/decision note only after pending and unallocated transactions are resolved. This clears the hold without changing financial totals. Fully refunded invoices can be voided; payment history is retained. No API in this implementation sends a refund or charges a saved card.

A callback reports a result only after a server verification. Independent sites return to their registered local billing path with `jktl_reference`, then call the central verifier through the authenticated proxy. Business-origin checkouts return to the Business project portal. Failed/pending results do not mark an invoice paid.

## Support and notifications

Tickets and conversations use the existing support engine, AI-first guidance, handoff, assignment, internal notes, escalation and email/PWA outbox. Ticket access is limited to the requester and project/organization; internal notes are never selected by client APIs. Attachments are private records on the existing support system. The team inbox has a custom-project filter and case links from Custom Projects.

The existing maintenance job at `/api/cron/domains` runs custom invoice generation and the transactional email outbox. Issued invoices, verified receipts, failed/pending payment status, due/overdue reminders and agreed instalment reminders use existing JKTL branding/provider. Recipient lookup requires active ownership. Financial notices link to the correct authenticated project portal. Existing renewal invoice generation stays unchanged. Email/push delivery requires working deployment credentials and a scheduled cron; neither a queued record nor a provider submission proves inbox delivery.

## Migration and deployment

`067_custom_project_portal.sql` is additive and repeatable. It adds metadata and relationships, project keys/owner grants/nonces, invoice payment/refund records and private support attachments. Existing data is retained. Only legacy paid invoice totals are backfilled. There are no client price changes, invoices created or payment requests executed by the migration. `scripts/prepare-website-templates.mjs` includes the migration for deployment.

Rollback: switch independent-site integration off, revert application code as appropriate and retain the ledger/schema for audit. Do not drop payment/support tables as a rollback. Restrictive invoice triggers remain. Take a database backup before any future destructive schema removal.

### Business environment

Reuse the existing `DATABASE_URL`, JKTL `PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_APP_URL`, session settings and current email-provider configuration. Existing cron authorization and PWA/VAPID settings remain necessary for reminders/push. Configure the existing Paystack webhook as `https://business.jktl.com.ng/api/webhooks/paystack`. Use Paystack **test** mode for controlled payment validation. No new central shared secret is required: project credentials are generated individually.

### Stick On Chic environment

- `JKTL_CENTRAL_PORTAL_ENABLED=true` **only after reconciliation and owner mapping**.
- `JKTL_PROJECT_ID`: the permanent UUID from Business Custom Projects.
- `JKTL_PROJECT_API_KEY`: the generated scoped key, private/server only.
- `JKTL_BILLING_OWNER_IDS`: comma-separated local `admins.id` UUIDs explicitly permitted to manage this project.

Keep its existing `SESSION_SECRET`, client `DATABASE_URL`, site URL and **store** Paystack credentials. Store checkout, settlement accounts, orders and customer invoices are unchanged. Remove obsolete JKTL-merchant credentials from the client deployment only after all legacy checkouts have been reconciled and cutover has been approved. Do not remove the client's store credentials.

### Pilot cutover checklist

1. Identify the actual local owner IDs and matching Business organization members; do not assume every admin is an owner.
2. Export/review existing local JKTL invoices, instalments, payments, pending references and service agreements. Preserve IDs, amounts, due dates and historical evidence. Do not recreate a paid balance as unpaid.
3. Reconcile with JKTL Paystack and the team's contracts. If legacy records need importing centrally, review an explicit mapping/import against actual records before enabling the switch. No unverified local paid flag is imported as verified money.
4. Register the central project, owner mapping, callback path and scopes; install the project key in secure environment settings.
5. Validate in test mode using an agreed test invoice, duplicate webhook, partial payment, failure/pending result, PDF, owner isolation, private support notes and key revocation. Never initiate real customer charges as a test.
6. Enable the flag and deploy. Legacy local records remain stored, but the infrastructure UI uses central records and the legacy initialization endpoint stops new local infrastructure payments. Existing legacy webhook reconciliation remains available for pre-cutover references.
7. Confirm emails/PWA and local callback behavior with authorized test users. Verify store checkout separately.

## Verification and limits

Automated tests use PGlite for actual schema/query execution and mocked Paystack responses. Browser fixtures are explicitly mocked, isolated and never send live payments. Both repositories need production builds/TypeScript checks; the central and pilot have separate deployment statuses.

Do not claim that the pilot is financially live until its actual owner mapping, private environment settings and legacy reconciliation are complete. This workspace's Business DB binding is available, but it does not provide the pilot's independent database, local owner session or Paystack/email/push test credentials. Browser mocks cannot establish real Paystack settlement, actual Gmail/PWA delivery or a production owner journey. Those require controlled deployment verification. No live charges, bulk emails or customer financial records are created during development tests.

### Verification performed for this change

- Business and Stick On Chic production builds passed; TypeScript checks passed in both repositories.
- Targeted ESLint passed. Stick On Chic did not previously have an ESLint configuration, so its changed files were checked with the existing Business flat configuration.
- Actual PostgreSQL-compatible queries ran in PGlite: invoice issuance/locking, 40/60 allocation, duplicate notifications, mismatched amount rejection, pending/failed transactions, verified refunds, late-payment review, scoped owner assertions, replay rejection, key rotation/revocation, tenant isolation, internal-note privacy and private attachment access.
- Existing custom-project and support regression tests passed. Pilot legacy billing tests and new explicit-owner/proxy tests passed.
- Isolated Playwright browser fixtures passed at 1440px and 390px for invoice details, next-instalment checkout handoff, support replies and attachment lists. Responses were mocked and no real payment/email was sent.
- Production server checks: unauthenticated central billing API 401; team invoice PDF 403; disabled pilot proxy 503; unauthenticated pilot invoice page renders only an access notice, never invoice data.
- Migration 067 applied and repeated against the configured Business database: two existing projects preserved; zero invoices, zero integration keys and zero enabled external integrations. No production customer billing records were generated for testing.

Pending activation: the actual Stick On Chic owner account/local ID mapping, its independent DB for legacy reconciliation, secure project-key installation and controlled Paystack test-mode/email/PWA verification. Shipping the code does not imply these external checks have completed.
