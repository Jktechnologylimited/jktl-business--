# Renewal register and manual fallback

Team controls: **Emails → Renewals & Reminders** (`/admin/emails/renewals`).
Business owners: **Renewals** (`/business/renewals`). Only authorized communications
managers may configure automation, edit manually tracked services, queue messages
or resolve provider exceptions. Owner pages scope every item to their organization.

The additive migration `068_renewal_safety.sql` adds a read-only union view over
registered domain assets, paid website subscriptions, active legacy hosting,
paid active/suspended business email and accepted recurring custom services.
Free defaults, legacy-free email, unaccepted proposals, cancelled subscriptions
and one-time projects are excluded. The same organization's legacy hosting is
not listed alongside its active website plan. Other services can be added to
manual tracking, with an account, name, date, optional recorded amount and billing
contact. Updating a tracked date does not register a domain, renew a service,
record payment, issue invoices or change an underlying subscription. Native dates
remain sourced from their respective service/billing records; missing dates are
flagged rather than guessed. No wholesale domain prices are exposed.

Automation starts **off** so dates and contacts can be reviewed before enabling
it. Existing product reminder jobs continue until central automation is enabled.
The existing daily and domain-maintenance cron jobs both call the central sweep;
no additional Vercel cron schedule is required. An authorized operator can also
run the scheduled check from the page or use preview/queue for a single renewal
without enabling automation. Queuing a manual message is an explicit send action;
previewing, opening the dashboard and running migrations never send mail.

Reminders use Africa/Lagos calendar days: 30/14/7/1 days before, due day, and seven
days overdue. A missed scheduled run selects only the current window, catching
up without blasting every missed reminder. Automatic reminders stop beyond 30
days overdue; these records stay visible for manual review. Source renewal dates,
cancellation and current billing contact are checked again before each send.
Wrong/missing contacts block sending. Current user email is preferred over an
outdated organization-member copy. A tracked billing contact is an explicit
manager override. Recorded amounts are reference values; customers review current
prices and payment status before paying, including existing automatic renewals.

Durable event keys and per-cycle/per-day uniqueness prevent repeated sends.
Provider idempotency keys and retry payloads remain stable. Known failures retry
up to three times, with backoff. An expired submission lease reconciles against
existing email-send history; uncertain outcomes enter UNKNOWN and never retry
blindly. Managers can retry only after recording provider confirmation of
non-acceptance, or record an accepted provider message ID and review note.
Provider acceptance is explicitly distinguished from inbox delivery. Opted-in PWA
push remains best effort after email acceptance. Email branding, John signature,
Reply-To and existing provider are reused.

On central takeover, superseded domain/email/custom renewal outbox rows receive
an explicit superseded timestamp. Receipts, setup notices, registrar alerts,
invoice issuance and agreed instalment notices remain unchanged. Manual fallback
also coordinates matching legacy jobs to avoid duplicate reminders. Recent legacy
renewal emails are considered before queuing central messages. Disabling central
automation does not resurrect superseded jobs.

The team dashboard shows missing data, overdue services, queue exceptions,
provider/cron configuration presence and the last automatic check. A check older
than 36 hours is flagged. Cron failures are returned as failures rather than
claiming success. These controls are a fallback, not a guarantee of inbox delivery;
use an independent scheduler/monitor if you need alerts when the hosting platform
itself is unavailable. Cron routes require the existing CRON_SECRET. Manual tools
use the existing authenticated team session and do not require sharing that secret.

## Editable business contacts and service-specific emails

Migration `080_renewal_communication_details.sql` extends this same register. Choose
a business on the Renewals page, or use **Edit business communication** in the
owner's business list. Authorized communications managers can edit the name used
in renewal emails, contact person, primary billing email, phone, additional
contacts, internal notes and active/paused/closed client relationship. This does
not change sign-in identities, public website content or paid entitlements.
Additional addresses are saved for human follow-up; they are not automatically
CC'd. An explicit service-specific email overrides the business contact; a blank
business contact falls back to the current active owner. Edits use revision checks
and atomic audit records, and immediately invalidate the relevant dashboard paths.

Each tracked service also has an editable billing interval, exact services
covered, renewal price/date, previous payment date/amount and payment-history note.
Historical amounts are explicitly owner-reported records. They do not issue
receipts, mark invoices paid, verify provider transactions, refund money or create
commissions. The due date must be advanced after an externally paid renewal is
reconciled. Native verified payments retain their existing automatic date updates.

Annual services use 30/14/7/1 days before, due day, and seven days overdue. Monthly
services use 7/3/1 days before, due day and seven days overdue. Existing daily jobs
are reused. The legacy register respects paused clients/services and suppresses
monthly reminders outside seven days, including during a rolling deployment.
Emails identify the business, list only its recorded services, show its current
renewal price and readable due date, and use a **Review renewal** action. The
existing branded provider, Reply-To, security and promotional eligibility rules
remain in use. HTML paragraphs/line breaks and plain-text copy carry the same
service information. Drafting, previewing and updating these details never sends
an email. The first automatic scan after a newly entered eligible date may send
the current reminder window.

For an externally managed contract that is also an unaccepted Custom service,
the tracking record may link to that exact same-tenant service. This permits
renewal communication without accepting the contract or charging the customer.
Once accepted, the native contract supplies the current price/date and keeps the
same reminder key; the duplicate tracking row is excluded. Pausing/cancelling the
source contract stops its linked reminders. Queued sends recheck contacts, dates,
price, name, scope and pauses. A stale retry is cancelled for a fresh reviewed
send rather than changing an already-used provider idempotency payload. Existing
Customer follow-ups handle seven-day overdue and exhausted/uncertain delivery
cases. A global pause or per-service pause does not disable the customer's login.

Validation uses real PostgreSQL semantics in PGlite, mocked email/push providers,
owner/manager authorization checks and browser fixtures. No live reminders or
charges are issued during implementation. The initial live inventory contained
no eligible active paid renewals, so existing externally managed services need
their actual dates entered or their native subscriptions activated before they
can produce reminders. No dates or payment status were fabricated.
