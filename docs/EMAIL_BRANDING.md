Latest update: [central Emails, invitations and Reply-To](EMAIL_MANAGEMENT.md) supersedes the older navigation and invitation workflow descriptions below.

# JKTL email branding and Team role controls

## Team correction

**Team → Add someone → Role** now includes Growth & Gaming Lead alongside
Affiliate Manager, Analyst, Support, Editor and Owner. It uses the existing staff
account form and authentication. All members appear in Current accounts; Growth
permissions are editable inline. Existing Business-linked Growth staff keep their
credentials. The former standalone Growth account-creation panel is removed.
Migration 048 permits native Team credentials as well as those existing links.
Growth staff still cannot approve payouts, change prices/rates, manage staff,
access private client workspaces or manipulate game results.

## Shared rendering and delivery

`src/lib/mail/layout.ts` is the canonical provider-independent renderer. It uses
email-safe presentation tables, inline styles, a 600px responsive maximum width,
absolute HTTPS JKTL logo, image fallback text, navy/gold/cream colors, a company
signature, a configurable support/legal footer and a plain-text equivalent.
Template data and admin-managed text are escaped. Branding/promotions accept
structured fields, not arbitrary HTML or JavaScript.

Existing Resend delivery, FROM addresses, recipients, triggers and durable
idempotency keys remain in use. The primary transaction or security message stays
first. No provider registration, price, payment, credential or activation state is
invented by the branding renderer.

Business templates updated include welcome, bookings/requests, invoices, receipts,
payment confirmations, customer/programme password resets, renewal reminders,
receptionist operational alerts, Affiliate approvals/declines, Partner approvals,
domain notices, Custom workspace invitations/notices, Business Email updates and
Partner support/programme notices. Official signature duplication is removed where
possible; merchant-specific invoice identity remains in the primary message.

Main’s existing waitlist and product-onboarding notifications reuse its existing
Resend HTTP delivery through `lib/mail.ts`. Privileged admin-password URLs and
plaintext provisioned passwords are no longer included. Provisioning itself is
unchanged; users are directed to sign-in or secure assistance. Existing webhook
notifications use reference-based provider idempotency keys.

Fantasy’s verification and reset sender reuses Resend and applies the shared
security layout. Its security tokens/expiry and game disclaimer remain intact.

## Admin → Communications

- **Email Branding:** company name, actual logo URL, readable dark header color,
  alignment, signature, support contact, genuine company postal address, social
  links, copyright, global promotion visibility, support promotion visibility and
  a 0–3 item limit. Optimistic revisions prevent overwriting another edit.
- **Email Promotions:** create/edit title, description, product, JKTL HTTPS
  destination, enabled state, priority/order, eligible categories and UTC start/end
  dates. URLs with credentials, secret query parameters, non-HTTPS schemes or
  non-JKTL promotional destinations are rejected. Security/internal categories
  cannot be selected. Seeded products use real Main destinations with no prices
  or invented benefits; replay never overwrites an administrator’s edits.
- **Preview & Test:** registration, website publication, domain status, Business
  Email, payments, Affiliate/Partner approvals, support, renewal and security
  samples. Desktop/mobile icons, HTML source and plain-text modes are available.
  Samples are explicitly labelled previews. Test sending is Owner-authorized,
  limited to the authenticated administrator’s own email and five sends per hour.

The new `manage_communications` capability is Owner-only by default. Growth staff
and other roles do not receive it automatically. Changes are audited and require
no redeploy. No live emails are sent by automated tests.

## Categories, consent and product eligibility

Security/recovery emails never show product promotions or social link listings.
Internal operational emails also exclude promotions. Essential transactional
messages remain deliverable when preference/branding storage is unavailable;
unknown preferences produce a clean branded message without optional marketing.

Optional promotions require an explicit marketing opt-in, no global opt-out, no
existing prospect suppression, configured postal information, matching category,
active schedule, eligible product and no known product ownership. At most three
distinct products appear, ordered by priority. Support promotions default off.
Native domain/email ordering configuration and active programme profiles constrain
eligible products. Contextual ownership plus actual current organization services
suppress products the recipient already has.

Business users manage their own choice at `/business/email-preferences`. Mail
footers contain an opaque preference link. Public `/email-preferences` requires a
confirmation POST; scanner GET requests do not unsubscribe people. The token can
only stop marketing, cannot enable it or disclose the email/account. Essential
security, payment and service notices are unaffected. Existing prospect unsubscribe
links, jurisdiction/consent checks, source disclosure and outbound sender/reply-to
are preserved; prospect suppression also blocks optional promotions globally.

Outreach must already pass its existing legal/consent workflow. The shared sender
also checks suppression and configured company postal information. Unknown
recipients are never opted in automatically. A global unsubscribe blocks future
marketing even when the original workflow was otherwise authorized.

## Durable event/support integration

Migration 049 adds branding, promotion and recipient-preference tables. It extends
the existing service email outbox with category/path fields, rather than adding
another delivery queue. Future actual website publication transitions and verified
website payment inserts queue idempotent notices. Existing Business Email queue
processing sends them through the same maintenance job and provider. Successful
website publishing/payment actions schedule an after-response flush; scheduled
maintenance remains the retry fallback. Existing
historical payments/publications are not backfilled or announced.

Partner support emails include the exact authorized public staff reply, agent
name, subject and ticket reference, linking to that ticket’s anchor in the
protected Partner inbox. Internal notes are never included. Sensitive tickets use
a generic secure-inbox notice rather than copying private details into email.
Current approved Partner identity checks and existing outbox delivery keys remain.

## Connected applications

`scripts/sync-email-layout.mjs` mirrors the canonical renderer into the attached
Main and Fantasy repositories. Their existing senders fetch only public company
branding from Business `/api/public/email-branding`, cache it for at most a minute,
and fall back to safe defaults if unavailable. No recipient, preference, token or
credential is sent to that public endpoint. Connected security/internal senders
never insert optional promotions without recipient preference integration.

Renderer changes require syncing/committing connected repos; ordinary admin
branding and Business promotion changes do not require deployment. Do not replace
recipient policy checks with public promotion data.

## Deployment/configuration

Prebuild applies additive migrations 048 and 049 through the existing SQL runner.
Migration 047’s replayed check is adjusted to retain native Growth staff accounts.
Existing `DATABASE_URL`, verified Resend sender settings and scheduled maintenance
must be present in deployment. No new mandatory secret or mail provider.

An Owner must enter the **actual company postal address** before marketing or
optional promotions are enabled in delivered messages. The application does not
invent an address or assume consent. Check the official HTTPS logo and configured
support/social links in deployment. Existing SPF/DKIM/DMARC and sender-domain
verification remain provider configuration, not something a template build proves.

Automated checks use isolated databases/mocked delivery and browser previews.
They cannot establish actual inbox delivery or rendering in Outlook, Gmail and
Apple Mail. Real-client smoke tests use the explicit admin test action; never
use customer recipients for automated tests.
