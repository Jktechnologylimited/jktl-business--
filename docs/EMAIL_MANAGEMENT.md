Latest footer update: [shared promotional footer fix, simple manager and WAT expiry](EMAIL_PROMOTIONAL_FOOTER_FIX.md).

# JKTL Emails, invitations and Reply-To

28 October 2026 (Africa/Lagos).

## One admin interface

**Admin → Emails** has four sections:

- **Compose Email:** individual or selected existing accounts; customers; all/active/dormant Affiliates; all/approved Partners; Team; each existing Team role.
- **Invite User:** roles from the existing `ROLE_LABEL` registry plus the existing Affiliate and Partner programmes. No invented Technical Support/Marketing role is silently added.
- **Email History:** current message counts and provider submission records, with safe failure retry; earlier Affiliate drafts/queue history remain reviewable.
- **Email Branding:** logo, signature, footer, product links, approved sender and Reply-To controls. Existing promotion and sample-preview tools are embedded here rather than added as new navigation sections.

Old Communications, Promotions, Preview and Affiliate communications/invitation URLs redirect to the appropriate section. Team still manages existing permissions, suspension and revocation, with a link to central invitations. The old owner-entered new-account password form has been removed. Editorial compatibility actions delegate to central Team invitations. Legacy Affiliate draft actions remain for old clients/outstanding drafts; new composition uses the central interface, the same existing `affiliate_campaigns` draft storage and the same programme outbox. No second provider, inbox, receiving service, user table or background job was created.

## Sender and Reply-To settings

Email Branding now includes **Sender Display Name**, **Sender Email Address** and **Default Reply-To Email Address**. The application continues using Resend and its supported `replyTo` option; the SDK encodes the upstream Reply-To header. Existing automatic event senders and the shared canonical branding wrapper are retained.

The sender email must be the already configured `RESEND_FROM_EMAIL` mailbox or a mailbox in secure `EMAIL_VERIFIED_SENDER_ADDRESSES` (comma-separated). Add a mailbox to that allowlist only after verifying it with the existing provider. This interface does not change DNS authentication, verify sender domains or create mailboxes. The existing sender remains the fallback until a setting is saved.

**`info@jktl.com.ng` is a suggestion, not an automatically verified Reply-To.** The Reply-To header stays unset until an authorized owner records a verified mailbox. Adding/changing an address requires explicit confirmation that the mailbox exists and is authorized to receive JKTL replies. This is an auditable administrator attestation, not a claim that Codex performed an inbox delivery test.

Optional categories: Affiliate, Partner, Administration, Editorial, Support and Security. Blank category settings fall back to the default. Blank default preserves provider-normal reply behavior. No category-specific mailbox is assumed to exist. Additional verified mailboxes can be approved for individual overrides. Values are single validated mailboxes: no address lists, display-name syntax, CRLF or header injection.

Compose Email initially contains the default Reply-To. An individual override must remain in the approved list and is validated again server-side. Programme managers are additionally restricted to programme/support/default reply contacts. An owner can choose any approved override. Recipient preferences do not change Reply-To identity, and user-provided support text cannot inject a header. Private sender configuration and the reply allowlist are excluded from the public visual-branding endpoint.

Automatic welcome/service/domain/payment/subscription messages use the verified default unless a category contact applies. Affiliate/Partner invitations explicitly select the corresponding programme contact, Team invitations select Administration or Editorial, and security/recovery messages use Security/default. Security emails never include promotional products. Existing prospect outreach keeps its separately configured sender/reply routing, with single-address validation and the corrected provider option.

## Composition and delivery

The existing Editorial format is Markdown. Compose provides formatting controls and a sandboxed HTML preview using its existing Markdown parsing dependencies; raw HTML, remote image markup and unsafe link schemes are excluded. Both HTML and plain text are sent in the shared navy/gold/cream layout with the official existing HTTPS JKTL logo.

Recipient selection uses actual account/programme/role records, lowercases/deduplicates addresses and caps a reviewed message at 500 accounts. Owners can address all authorized categories. Affiliate Managers can compose only within Affiliate/Partner audiences; they cannot assign Team roles, change branding or access global send history. Selected addresses must match actual accounts within that authority.

Preview creates an unsent draft and returns the unique eligible count. Sending requires explicit confirmation of that exact snapshot. Eligibility/preferences are checked again, new group members are never silently added, and necessary operational messages require confirmation that the main message is operational. They include the same shared footer as other ordinary emails, respecting opt-outs and saved footer settings. Promotional messages require current opt-in, no suppression and the genuine configured company postal address. Send-time suppression is checked again through the existing branding/preferences layer.

Messages are queued individually in `distribution_program_notices`; no CC or public recipient list is sent. The existing programme worker/cron handles them, with row leases, stable provider idempotency keys and bounded per-worker pacing. Queue draining still depends on the frequency and duration of the existing deployed cron. Large audiences are not promised immediate delivery; configure an appropriate schedule for that existing endpoint under the deployment/provider plan, rather than creating an overlapping job.

Each composed message tracks queued/submitting/provider-accepted/failed/unknown outcomes. Accepted messages and uncertain submissions cannot be retried through the retry control. Only explicit pre-submission failures or definite provider rejections qualify. Network errors, server errors and ambiguous idempotency responses are held for provider review. If a worker crashes after submission, stored acceptance metadata can finalize the queue record without another send; otherwise the stale submission becomes UNKNOWN.

Email History labels **provider acceptance separately from delivery**. It records provider message IDs where returned, category, recipient, subject and safe error codes. It does not store automatic email bodies, reset URLs, invitation bearer tokens or passwords. Actual delivery remains unconfirmed until a supported, verified provider delivery event is available; no delivery webhook or status is fabricated. Existing notification queues retain their operational triggers and semantics.

## Invitations and existing identities

Team invitations extend `editorial_invitations`; programme invitations extend `affiliate_invitations`. Tokens have 256 bits of randomness, only SHA-256 hashes are stored, expiry defaults to **48 hours**, and owners can configure 1–168 hours. Accepted/expired/revoked/pending states, acceptance dates, resend and revocation are visible centrally. Resend rotates the token and can renew an expired invitation. Only one outstanding Team invitation per profile is permitted; superseded links are revoked.

A new Team recipient chooses their own password at acceptance. Existing Team recipients must authenticate to that account and keep their password. Existing Business recipients authenticate to their matching Business identity and receive an explicitly linked Team profile, without a new Business account or password reset. Email matching alone never grants access. A Business account created after invitation cannot bypass matching-account authentication. Existing linked sign-in and logout now cover the permitted Team roles through the same authentication/session infrastructure.

Acceptance checks the current inviter's authority, recipient identity, token expiry/revocation, current profile state and existing last-owner protections. Grants occur only at acceptance. Token use is single-use under locking, and Team acceptance/view requests are rate-limited. Invitation pages are private to the bearer link, noindex and no-referrer. No invitation preview creates a role or account.

Affiliate/Partner invitations require a valid proposed policy from the existing programme process. The recipient signs in/signs up through the existing Business flow and explicitly accepts terms. Partner profiles remain **pending** for review and agreed terms; invitation acceptance does not activate financial policies or contracts. Existing Affiliate policy-activation safeguards remain intact. New programme profiles are linked to the original Business user, whose password stays unchanged.

## Schema and deployment

Additive migration **060_email_management.sql** is included in the existing migration runner and deployment prebuild. It extends existing drafts, queues and invitation tables, adds a metadata-only `email_send_history`, and enforces unique live invitation indexes. If legacy Team data contains duplicate outstanding invitations, the newest expiry is retained and older duplicates are marked revoked. Accepted grants, customer service orders, payments, subscriptions and previous programme queue entries are preserved.

New direct dependency declarations for `unified` and `remark-parse` reuse the versions already installed and locked for the existing Markdown editor; no new sending provider or editor framework is introduced.

Required operational configuration:

1. Apply migration 060 through the existing deployment workflow with its secure `DATABASE_URL`.
2. Keep the existing `RESEND_API_KEY` and verified `RESEND_FROM_EMAIL` configuration. Add only provider-verified sender mailboxes to the optional secure allowlist.
3. Confirm Reply-To mailbox existence/reception, then save verified default/category settings. No mailbox was created or verified by this implementation.
4. Configure the genuine company postal address and preserve consent/suppression records before promotional sends.
5. Confirm the existing programme maintenance cron is enabled and scheduled appropriately for expected volume.
6. Use the restricted self-test preview after deployment to check real provider acceptance and inbox rendering. No real invitation, bulk email or test email was sent during automated verification.

The current workspace has no deployed database binding. Tests use disposable PostgreSQL-compatible databases and mocked provider responses. Local build success does not claim that production migrations, mailboxes or delivery were validated.

Validation results: the selected 188-test regression run passed, including existing domain/payment, Business Email, editorial, support, partner, role and schema checks. The expanded email-management suite passed all 13 tests, including rendered branding/history/invitation server pages against real disposable database queries. Production build, TypeScript, focused ESLint, lockfile dependency checks and diff checks passed. Provider calls were mocked; no live mail delivery or deployed database application was claimed.

Local production checks: all four Emails routes returned 307 to Team sign-in without authentication; public branding returned 200 without private sender/Reply-To settings; the official logo returned 200 as PNG; invalid Team invitations returned a generic response with no-referrer metadata. Live database and provider bindings were absent during these checks.

Key implementation files: `src/app/admin/(command)/emails/` (the four sections), `src/lib/actions/email-compose-actions.ts`, `src/lib/actions/team-invitation-actions.ts`, the extended Affiliate invitation actions, `src/lib/mail/` (headers, rendering, invitation core, queue recovery and metadata), and `src/lib/email.ts` (existing Resend delivery). Existing Team controls, session linking, old-route redirects and the public visual-branding projection were updated. Automated coverage is in `tests/email-management.test.mjs` plus the existing regression suites.
