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

The new ledger consumes only actual verified live Paystack website subscriptions.
Currency, captured amount, reference, transaction ID and actual processing fees
must match the native payment. Net revenue deducts agreed included tax and
pass-through costs; integer rounding, commission caps and margin reserve apply.
A locked per-client service-month allocation caps rewards at the agreement's
1–12 paid months. Annual payments earn once. Duplicate/replayed events do not
create another payment or commission. Other products default to noncommissionable.

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

Prebuild includes additive migrations 041–046 through the repaired dollar-quote
aware SQL batch runner. `DATABASE_URL` is required to apply them. No new mandatory
environment variables; email, Web Push, Paystack and cron use existing settings.
Absent delivery configuration leaves durable notices pending. Enable existing
scheduled cron processing before relying on background reconciliation/delivery.

Tests use isolated PostgreSQL-compatible PGlite and mocked providers, exercising
migration replay, identity links, invitation grants/revocation, proof validation,
concurrent finance replay, holds/refunds/debt, immutable history, quote payment,
attachments and native service isolation. They do not establish live provider
registration, mailbox licensing, email/push delivery, real payouts or production
migration success. Validate those with authorized test accounts in deployment.
