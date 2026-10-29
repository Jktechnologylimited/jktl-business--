# Custom client integration audit and rollout

## Scope and current state

Business reuses organizations/memberships, Custom Projects, invitation emails, service proposals/invoices, Paystack verification, cron notifications and the shared support inbox. No second authentication or billing system was created. Migration `062_custom_client_integrations.sql` extends existing records; it does not seed customers or alter contracts. The approved first client is **K.K. Ubani and Co**, owner **info@kkubaniandco.com**.

This delivery implements the central extensions and an independently deployed pilot adapter. Production database records, email delivery, actual CMS publication, invoices and post-deployment continuity have not been verified. Never infer a working connection from the presence of a project row or an operator confirmation flag.

## Existing repositories inspected individually

| Repository | Architecture found | CMS integration boundary |
| --- | --- | --- |
| `kkubani-pioneer` | Next 16 / React 19 App Router; homepage text in `components/Hero.tsx` and `components/Welcome.tsx`; SMTP contact/booking APIs; no existing CMS/database | Full-site editor added in this repository only: 538 registered text/image/link/SEO fields, section/search controls and replacement image uploads. Private Blob document contains draft/published/revision/bounded audit. See its `docs/JKTL_CUSTOM_PILOT.md`. |
| `bae-label` | Next 16; PostgreSQL JSONB and Blob; existing admin authentication, CMS, artists/events/ticketing/financial functions | Reuse existing CMS with a content-only adapter; no access to ticket purchases, payouts or general administration. Not connected by this delivery. |
| `nej-clo` | Next 16; Neon; bcrypt/jose; existing products/orders/content/branding administration; `src/lib/site-content.ts` persists `site_content` | Reuse content persistence and revalidation. Define supported content/product fields separately from orders/customer data. Not connected by this delivery. |
| `newlife-phc-project` | Next 16; Neon/Blob; jose student/parent/staff/admin roles; `/portal/admin/content`; `src/lib/admin/actions.ts` and institution schema | Reuse authorized content actions only; never map Business CMS scopes to student, finance or whole-school administration. Not connected by this delivery. |

Other local client repositories were inspected read-only. No source code was moved into Business. Independent GitHub/Vercel deployments remain intact. References are metadata, not deployment credentials or permanent identities.

## Central additions

- Project deployment provider, optional Vercel/GitHub references, linked same-organization Business Email, maintenance agreement and private notes. Hosting/other charges use existing project-linked service agreements.
- Explicit `content:read`, `content:write`, `content:publish` scopes and supported field identifiers. New projects default to read-only. Changed callback/scopes/field manifest clears CMS-test confirmation; key rotation also disables access until reconfirmed. Existing confirmed integrations retain prior scopes once during migration; rerunning never restores removed permissions.
- Customer project projection excludes internal notes, repository/deployment references and integration hashes. Only actually linked domain/email data is displayed.
- One-use grant scopes are intersected with current permissions at exchange. The server-only adapter rechecks live membership, owner identity, project/client status and current scope on each pilot operation through `/api/custom/cms/session`. A site must still enforce its own content schema/session/tenant binding.
- Project/category fields on the existing support cases. Customers use `/business/help?project=<UUID>`; authorized support sees safe project context. New compatibility requests go to that inbox. Existing custom-request history remains readable/respondable.
- Invitation acceptance/revocation timestamps for new events, readable WAT status display. Historical used invitations without these timestamps are not falsely labeled accepted or revoked.

## Repeatable onboarding

1. Apply all migrations through `npm run db:migrate` using the secure Business environment. The prebuild also includes 062. It is additive and idempotent; normal backup/recovery procedures still apply.
2. Admin → Custom Projects: find/create the approved owner/client. Existing owners retain passwords and organization; explicitly resolve multiple owned organizations. Never seed a guessed account or copy a client's database secret.
3. Register the stable project UUID, real production URL, repository/deployment references, customer-visible description and private operational notes. Link only verified owned service records.
4. Configure actual agreed hosting/maintenance/managed service charges and dates. Existing proposals require explicit customer acceptance before generating invoices. No new prices or automatic debit mandates are invented.
5. Implement/configure that website's adapter, field allowlist, scopes and server secrets. Start with an authorized pilot invitation and read-only access. Readiness/test confirmation controls are explicit operator gates: enable them only for controlled validation, and disable them on any failure. Do not claim live CMS support before completing publication checks.
6. Invite the approved owner individually after reviewing account identity and project visibility. No passwords are emailed. Verify acceptance using the real intended account; test normal login, supported draft/publish, revoked permissions and rejected foreign project IDs. Use approved harmless content and restore it afterwards.
7. Test the existing support inbox, accepted pricing, invoice creation and authorized payment test process. Confirm notification cron/provider setup. Deploy a new website commit and verify the same project UUID, published content, membership, linked services and billing records remain unchanged.
8. Only then onboard the next repository using its own reviewed CMS schema and permissions.

## Billing and security retained

One-time/monthly/annual proposals, discounts, accepted revision snapshots, invoices, renewals and payment history use existing Custom billing. Exact amount/currency/customer/organization checks and provider-transaction uniqueness remain in Paystack verification. No automatic charge is made merely by registering a project; no payment was made during this implementation. Registrar domain renewals continue through the existing domain workflow. No new upload surface was added.

The pilot does not collect client database credentials. Its integration key and private Blob token are server-only. Text is validated and React-escaped; updates are revision/ETag guarded, with actor audit. Client content sessions cannot administer deployments, users, finance, school portals or ticketing. Outages/revocations fail closed for editing; public site rendering remains independent of Business availability.

## Validation and outstanding live steps

- Business TypeScript check and production build passed; no production DB was attached during build.
- Actual isolated PostgreSQL tests cover migration replay, CMS grants/key rotation/expiry/replay/current scopes, tenant boundaries, invitation activation, accepted pricing/invoice/payment idempotence and shared support authorization.
- Pilot tests now cover the full 538-field schema, link/image validation, legacy record migration, upload guards, all-page SEO/sitemap coverage, draft/published separation, stale revisions, conditional writes, session expiry/tenant binding and central authorization failure. Browser editor interactions use mocked saves/uploads; live publication and email delivery remain unverified.
- Local Chromium checks passed on built applications: original desktop/mobile homepage, gated/noindex editor, editor absent from sitemap, invalid callback/exchange/session rejected and Business/team login redirects. Provider calls in automated tests are mocked; these checks do not prove deployed end-to-end connectivity.
- Still required: rotated secure Business DATABASE_URL, website private Blob binding and integration secrets, actual client/project registration, approved contract prices, controlled owner invitation, deployed CMS publish/revoke/redeploy checks, real mail/provider and authorized payment validation. No live invitations, charges or client database mutations were performed by this delivery.
