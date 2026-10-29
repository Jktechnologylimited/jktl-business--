# Custom client integration: current architecture and rollout

## Approved pilot

**K.K. Ubani and Co**, owner **info@kkubaniandco.com**. The existing owner, organization and project have been verified and preserved. The project is configured for the Business-managed editor with its 538-field manifest. Account activation remains required; configuration does not activate the account, send email or mark a deployed publication as verified.

The client signs into Business and opens **My Projects → Manage website**. Editing now stays inside Business, using its existing session, DATABASE_URL, permissions and email provider. K.K. Ubani needs no additional private environment variables, API key, session secret, client database or Blob service. Its source contains only a public project reference and Business origin for fetching published content/images.

## Repository boundaries inspected

| Repository | Architecture | Integration boundary |
| --- | --- | --- |
| `kkubani-pioneer` | Next 16/React 19; existing hardcoded public pages and SMTP contact/booking handlers; no prior CMS/database | Full manifest covers homepage, services, attorney cards/biographies, images, contact/social links, hours, testimonials, client logos, navigation, form display copy, footer, 404 and page SEO. Independent source/deployment remains. Business stores editable data and runs the editor. |
| `bae-label` | Next 16; PostgreSQL JSONB/Blob; existing admin CMS, artists/events, ticketing and finance | Inspected read-only. Reuse existing CMS with a reviewed content-only adapter; do not grant finance/ticketing access. Not connected by this delivery. |
| `nej-clo` | Next 16; Neon; bcrypt/jose; existing content/branding/products/orders | Inspected read-only. Reuse site_content and existing publication mechanisms; keep orders/customer records separate. Not connected by this delivery. |
| `newlife-phc-project` | Next 16; Neon/Blob; student/parent/staff/admin roles and content portal | Inspected read-only. Reuse authorized publication actions only; do not grant student, finance or school administration access. Not connected by this delivery. |

No client source repository was copied into Business. The project manifest is a field schema/default public content, not executable website source. Other websites' existing CMS/API-key contracts remain available and unchanged.

## Data and security

- Migration 062 adds project deployment metadata, internal notes, linked email services, scope/field declarations, shared support context and invitation-event timestamps. Customer project projections exclude internal deployment references and key hashes.
- Migration 063 adds tenant-bound content/media tables. Saves atomically update draft, optional published snapshot, expected revision and a bounded actor audit. Old invoices, services, domains and customer records are retained.
- Migration 064 adds an opt-in managed-editor flag and validated manifest. Normal Business owner membership, exact approved client identity, account activation, pilot readiness, LIVE status and per-operation scopes are required on every read/save/publish/upload action. Team configuration uses existing manage_custom authorization. Other owners, staff, revoked memberships and unactivated clients are denied.
- Public managed-site endpoints serve only the published snapshot and public presentation images for explicitly enabled LIVE projects. They expose no draft, audit, credential, private client record or write method. Public reads require no site key because the data is intended for the public website. Existing private external-CMS APIs stay authenticated.
- Each manifest is size/type bounded. Content is checked against exact registered fields; text is React-escaped. Image/link URLs are constrained. Uploads accept PNG/JPEG/WebP up to 3 MB with signature checks and authenticated owner scopes. Stale/concurrent writes are rejected; ambiguous writes are never blindly retried.

The website fetches published content server-side, with original-source fallback on Business outage. Source deployments stay independent, while editable-data availability depends on Business. Existing SMTP variables and workflows are unchanged.

## Onboarding without new client secrets

1. Register/find the actual client owner and organization using Team → Custom Projects. Resolve multiple owned organizations explicitly; never create a duplicate or email a password.
2. Register the stable project UUID, real production URL, private operational metadata and only actual linked services. The UUID does not change with deployment/commit/hostname.
3. Under **Editor inside JKTL Business**, import the website's field manifest, enable managed editing and select approved read/write/publish permissions. This is already configured for the approved K.K. Ubani pilot. No per-site integration key is needed for this mode.
4. Deploy Business and the client repository. Send one secure invitation through the existing workflow and have the intended owner activate/sign in. No source deployment should implicitly change billing or activate users.
5. Verify project visibility, draft/save/publish, stale-write rejection, revoked permissions, uploads, support and independent redeployment using approved harmless content. Do not claim completed live publication or login until checked.
6. Configure real approved prices/services through existing proposals, explicit acceptance and invoice/payment verification. Do not invent charges or auto-debit existing clients.

K.K. Ubani's environment/connection guide is in its repository at docs/JKTL_PRIVATE_SETTINGS.md. The existing client/project is configured, but owner activation and deployed end-to-end publication/email checks remain outstanding.

## Validation

Isolated PostgreSQL tests cover migration replay, tenant isolation, Business owner authentication/scopes, unactivated/revoked accounts, strict manifests, drafts/publication, stale/concurrent revisions, images, admin configuration, existing invoices/payment idempotence and secure invitations. Client tests cover secret-free read-only transport, schema validation, legacy content, outage fallback and all-public-page metadata/sitemap discovery. Browser fixtures use mocked saves/uploads; no customer content, invitation or payment is changed by those tests. Both production builds and TypeScript checks passed. Chromium verified Business login gating, published-only API responses, rejection of public writes/private draft reads, secret-free client desktop/mobile rendering, safe legacy redirects and sitemap exclusion. The managed editor browser fixture passed section/search, draft/publish controls, image replacement and read-only behavior. Read-only requests used the existing Business database; saves/uploads used isolated test data or mocks.
