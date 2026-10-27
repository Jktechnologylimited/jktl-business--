# Distribution platform

## Account and agreement model

Business users apply at `/business/programs/apply` without a second password.
Each Affiliate or Partner profile requires independent approval. Existing accounts
are linked only after proving their programme password; matching email alone does
not grant access. Migration 046 allows separately approved profiles for the same
email and prevents linking a profile as the wrong programme. Existing IDs,
passwords, referral codes and history are preserved.

Applications contain audience/client-service details, review stages, private audit
reasons and separate applicant-visible messages. Rejection retains the record.
`/admin/distribution/applications` complements existing approval operations.

Migration 038's global proposed 15%/20% policies remain DRAFT. No production account
is automatically converted. Owner administrators can offer an individually
snapshotted agreement to a participant without existing referrals or earnings.
The participant must accept; Owner activation requires explicit formal approval.
Existing legacy snapshots, fixed bonuses, retention rewards and paid history are
not recalculated. Legacy percentage/fixed-tier differences require reconciliation
of signed obligations; current mutable settings are not proof of historical terms.

## Referral acquisition and payment finance

Marketing referrals use an optional, explicit-consent 30-day opaque HttpOnly
cookie shared with Business. The capture API permits only trusted origins, limits
requests and checks active codes. Attribution checks expiry, existing acquisition,
prior purchases and self-referral. No cookie is created merely by landing on a
page. Privacy preferences clear it; declining does not block signup.

Owner-accepted Partner invitations may attribute an eligible new unpaid client to
an active referral agreement, with disclosure. Existing attribution always wins.
Reseller agreements never also earn referral commission.

The shared ledger consumes actual verified live Paystack website subscriptions and explicitly enabled native product payments, as described below.
Currency, captured amount, reference, transaction ID and actual processing fees
must match the native payment. Net revenue deducts agreed included tax and
pass-through costs; integer rounding, commission caps and margin reserve apply.
A locked per-client service-month allocation caps rewards at the agreement's
1–12 paid months. Annual payments earn once. Duplicate/replayed events do not
create another payment or commission. Products without an accepted, activated eligibility rule remain noncommissionable.

Earnings begin held, then require reconciliation before becoming available.
Signed dispute events hold unpaid amounts; verified refunds reverse unpaid amounts
or create an idempotent negative adjustment against paid history. Open disputes
freeze payouts. Owner reconciliation requires provider evidence; it never guesses
that a resolved dispute was won. Paid financial facts are immutable.

The new payout ledger reserves reviewed earnings and unsettled debt once, with a
saved verified beneficiary snapshot. Minimum and monthly request day are Owner
settings; existing legacy rules are unchanged. Authorized staff record actual
manual transfer references after approval. The application does not initiate bank
transfers. Beneficiary reveal is capability-checked and audited. Participant CSV
statements are private and mitigate spreadsheet formula injection.

## Reseller operations and resources

Active reseller Partners receive written per-service quotes. The actual named
billing business owner accepts scope and billing responsibility. Fulfillment
requires an exact paid native domain/email order or custom invoice plus actual
supplier cost/reference. Acceptance itself never charges or provisions anything.
Supplier margin and payment evidence are audited. GO54 procurement, licensing and
mailbox provisioning retain their existing approved operational controls.

Owner-approved HTTPS marketing resources are audience scoped. The supplied JKTL
mark is reused in programme navigation, resource library and notification emails.
Durable transactional notices cover applications, agreements, finance and payouts;
processing uses existing configured email delivery. No promotional mail is sent
by tests. Partner ticket notifications are documented in PARTNER_WORKSPACE.md.

## Deployment and verification

Prebuild includes additive migrations 041–054 through the repaired dollar-quote
aware SQL batch runner. `DATABASE_URL` is required to apply them. Email, Web Push, Paystack, Blob uploads and cron use the existing secure bindings.
Absent delivery configuration leaves durable notices pending. Enable existing
scheduled cron processing before relying on background reconciliation/delivery.

Tests use isolated PostgreSQL-compatible PGlite and mocked providers, exercising
migration replay, identity links, invitation grants/revocation, proof validation,
concurrent finance replay, holds/refunds/debt, immutable history, quote payment,
attachments and native service isolation. They do not establish live provider
registration, mailbox licensing, email/push delivery, real payouts or production
migration success. Validate those with authorized test accounts in deployment.

## Completion work: migrations 050–054

Reseller quotes now expose a checkout action to their named billing organization
owner. The action locks the accepted quote, creates one billing-only project and
one accepted one-time service/invoice in the existing custom invoice system, then
uses the existing Paystack initializer and verifier. Repeated clicks reuse the
invoice. Fulfillment requires that exact invoice to be paid. Billing-only records
are hidden from the customer's website project list; their invoices remain visible.

Programme notices track email and push independently. Ticket notices likewise
track each channel, so an outage does not discard the other channel or resend a
completed channel on retry. Team email recipients are scoped by role, assignment,
sensitivity and current Growth permission. Internal notes never become notices.
Team attachment links use an `/admin` endpoint to preserve the existing path-scoped
Team cookie. Assigned Growth users can opt into routine Affiliate ticket alerts
using their current Business session; logging out deletes that push binding.

The Affiliate navigation has five sections. Secure invitations reuse ordinary
Business signup/login, require the invited email and a single-use hashed token,
and never reset an existing user's password. Invitations snapshot proposed terms;
acceptance grants programme access but does not activate a financial contract.
Owner offer, participant acceptance and separate Owner activation are still required.
The 15%/20% global policies remain DRAFT.

Inactivity monitoring uses qualified recorded visits, signups and verified ledger
entries. Existing accounts are exempt by default. An Owner must review contractual
provisions before removing an exemption. Automatic suspension defaults off and
requires fourteen actual days in dormancy after the dormant notice, rather than
backdating that grace period. Seven-day invitation reminders rotate secure tokens;
new invitation expiry and inactivity windows are configurable. Privilege changes
preserve Business accounts, referrals, ledgers and payout history. Authorized Team
members can complete legitimate previously requested payouts after suspension.

The existing resource library includes six finished branded SVG graphics, ten
social captions, five direct messages, three outreach emails and three follow-ups.
It supports product/format filtering, preview, download, referral substitution,
copying and sharing. Owners can edit, feature, archive or hide approved materials;
Growth retains its existing draft-and-approval workflow.

Affiliate campaigns reuse the programme outbox and shared email renderer/provider.
They snapshot up to 100 opted-in recipients, show a preview and exact recipient
list, require confirmation, rate-limit sends, and recheck suppression at delivery.
Provider acceptance and suppression counts are reported without claiming inbox
receipt. Security and financial notices remain separate from marketing campaigns.

### Verification and remaining scope

`npm run verify:launch` is read-only and reports configuration/schema readiness
without revealing credentials or creating payments, messages or accounts. This
workspace currently has none of DATABASE_URL, RESEND_API_KEY, the VAPID key pair,
CRON_SECRET, PAYSTACK_SECRET_KEY or BLOB_READ_WRITE_TOKEN. A configured Vercel deployment does not make
those bindings available inside Codex. Supply them through secure environment
settings, or run the verification command in the deployment environment.

Local verification uses isolated PostgreSQL-compatible databases, mocked providers
and browser fixtures. It does not establish deployed migration success or actual
email, push, checkout callback or supplier fulfillment delivery.

The same verified ledger now supports explicitly accepted percentage or fixed
product rules for Business Email, domains and custom projects. These products
remain off unless the individual agreement names them. An Owner must record
actual supplier/fulfillment cost evidence for each paid order; price-list guesses
are not used. The engine re-verifies live provider transactions, organization,
reference, amount, currency, buyer, native order identity and processing fees.
Subscription limits are allocated per customer/product, within the same ledger.
Billing-only reseller invoices cannot accrue referral commissions, and a paid
reference cannot be used to stack a reseller discount with an outstanding reward.
Signed refund/dispute events and verified domain refunds use the existing reversal
and adjustment controls. Eligibility pauses prevent reactivation from accruing
payments captured during suspension.

Future offer defaults are ₦50,000 minimum and an expected 28th payment day, with
a separate request-opening day. Existing accepted settings are snapshotted before
future defaults change; legacy commission/payout records remain untouched. Changing
future defaults cannot rewrite an accepted agreement. Financial Team members can
review earned pre-suspension commissions and request a payout on a participant's
behalf, using the saved verified beneficiary and the preserved accepted schedule.
Actual transfer confirmation remains a separate manual step. Historical terms that
differ from current code still require the existing Owner reconciliation workflow.

Marketing uploads reuse Vercel Blob and the existing distribution asset store.
PNG/JPEG/WebP signatures, size, rights and roles are checked. Growth uploads stay
unpublished until Owner approval; failed database writes clean up the uploaded blob.
This requires the existing BLOB_READ_WRITE_TOKEN binding. Activity filters include
persistent last sign-in and qualified promotional activity; signing in alone does
not reset the promotional inactivity clock.
