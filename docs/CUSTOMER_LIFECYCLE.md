# Customer lifecycle follow-ups

Team → Emails → Account Journey controls the automatic journey. Team → Support → Customer follow-ups holds the human work queue. These pages use the existing Team permissions, email provider, branding, signature, Reply-To and preferences. Nothing publishes a site, changes its template, charges a customer or changes a subscription.

## Default schedule

For each registered business owner, the current stage starts a new clock:

| Stage                                     | Next step                                               |
| ----------------------------------------- | ------------------------------------------------------- |
| No selected website                       | Choose and customise a free template                    |
| Draft website                             | Review and publish the existing template                |
| Published on a free address               | Optional custom domain, subject to marketing permission |
| Published with an owned/unverified domain | Connect the existing domain                             |
| Verified custom domain                    | No setup nudges                                         |
| Existing Custom client                    | No generic setup nudges                                 |

Send a helpful message after 3 days, a follow-up after 7 days, and create a human task after 14 days without progress. Administrators can edit these intervals and the minimum 3-day gap between accepted setup emails to a mailbox. Accounts sharing a mailbox share that cooldown. A renewal email accepted in the last day also defers setup messages.

Initial installation starts clocks now, including for existing accounts. It does not backdate setup messages to account creation. New accounts are picked up automatically. Unclaimed prospect/demo sites without an active registered owner are excluded. A stage or owner change starts a fresh cycle and cancels unsent old-stage messages. Missed jobs queue only the latest applicable step, rather than a backlog of both messages.

Optional follow-ups respect suppression. Domain offers require marketing opt-in and the configured company postal address. The free address remains a valid option. An owned domain is not presented as another purchase. Custom clients retain their existing sites.

## Renewals

The existing Renewals & Reminders system remains the sole renewal sender. Its configurable switch is also visible on Account Journey. Actual domain, hosting, website-plan, email and accepted custom-service dates drive the existing 30/14/7/1-day, due-day and overdue reminder windows. No dates or obligations are invented. A new renewal date starts the next cycle; free accounts do not acquire paid renewal obligations.

An unresolved renewal overdue by seven days, exhausted delivery failures, ambiguous delivery or missing renewal dates creates a human task. The team must confirm missing dates before reminders can be sent. Renewals follow their due dates independently of an account's setup clock and setup pause.

## Human fallback and delivery safety

The support queue allows assignment to an active authorised team member, progress notes, status changes and an account setup pause/resume. Coordinate with existing support tickets before contacting the customer. A concurrent edit is rejected so it cannot silently overwrite another team member's work. Stage tasks close when the account moves forward.

Provider acceptance is not proof of delivery. Stable message keys, unique stage/step records, leases and recipient claims prevent duplicate submissions. Definite failures retry on later days up to three attempts. Timeouts and unknown results are held for an authorised communications reviewer. They must check provider history before marking acceptance, cancelling or explicitly approving a retry. Support cannot close an unresolved provider-review task to bypass this check.

Replies go to the existing configured Reply-To mailbox. This feature does not ingest replies or build an inbox. If a customer replies and is being helped, the team should pause setup follow-ups while working with them.

## Operations

The existing `/api/cron/daily` schedule runs at 07:00 UTC (08:00 WAT; Vercel Hobby may vary within its scheduled hour). Renewals and lifecycle emails run ahead of legacy push setup nudges. No additional Vercel cron slot is used. The protected `/api/cron/customer-lifecycle` endpoint is available for an external scheduler or controlled operational fallback using the existing CRON_SECRET. Never expose that secret in URLs or browser code.

Scan accounts queues eligible work without sending it. Process due emails submits eligible queued work. Last scan/dispatch timestamps and a stale-scan indicator help detect missed automation. Existing provider and scheduler credentials must remain configured in the deployment. Database settings survive redeploys; migration 070 does not reset existing administrator choices.

## Verification

Automated tests execute migration 070 and lifecycle SQL against isolated PostgreSQL-compatible PGlite fixtures. They cover stage changes, initial clocks, duplicates, preferences, shared mailbox cooldowns, pauses, missed steps, unknown submissions, controlled retries, renewal handoffs, capabilities and concurrent edits. Existing renewal and customer-care regression tests are included. Browser checks render the actual Team page components with isolated fixture data at 1440, 390 and 320 pixels; they do not submit production forms or send mail.

Live initialization applies the additive schema and scans accounts without dispatching customer emails. This verifies database compatibility, not Gmail delivery. Real delivery should be monitored through the existing email history/provider and the Account Journey event list after scheduled messages become due.

### Installation verified 7 November 2026

The Business database contains 21 monitored registered accounts: 11 Custom clients, 8 without a selected site, and 2 published on free addresses. Initial scan queued zero email events and created zero human tasks. Account follow-ups and central renewals are enabled. There are currently zero tracked paid renewal items; the team must enter genuine service dates through the existing renewal/custom-service tools as services are added.

TypeScript, targeted ESLint, all three regression files and the three browser viewport checks passed. A complete production Turbopack build passed with the new routes. The standard webpack build encountered an existing `next/font` Google Fonts URL parsing failure in this workspace; no unrelated font or build configuration changes were made. Production delivery and the scheduled deployment run still require observation after deployment.

### Subscription CTA and sender update

Where marketing permission and sender requirements permit, follow-ups use a primary **Choose my website plan** button pointing to `/business/plans`, plus a secondary action for the current setup step. This does not choose or charge a plan automatically. Sign-in and onboarding preserve the fixed plans destination; arbitrary external redirect destinations are not accepted. Accounts without marketing permission receive helpful setup messages with a step-specific CTA instead. Domain upgrade offers remain permission-gated.

The shared sender defaults to `JKTL Business <notifications@mail.jktl.com.ng>`, using the domain JKTL confirmed verified in Resend. Replies remain directed to the existing verified `info@jktl.com.ng` mailbox. Retired ibiz sender settings are mapped to the new sender, including old environment values and outreach configuration. There is no fallback to the retired domain. Set `RESEND_FROM_EMAIL=JKTL Business <notifications@mail.jktl.com.ng>` in deployment settings to keep configuration explicit. The existing provider API key and DNS authentication are unchanged. No live test email or bulk campaign is sent by these checks.

The updated Business and Main production builds, TypeScript checks, scoped lint checks and email tests passed. The actual built Business app was checked in Chromium at desktop and mobile widths: `/business/plans` redirects signed-out visitors to `/login?next=plans`, and the signup link retains that intent. No customer login, checkout, charge or email was executed by the browser check. Shared Email Branding was updated in the existing database to the new sender while preserving the existing signature and Reply-To.

The production build now explicitly uses `next build --turbopack`. The uploaded Vercel log confirmed that the webpack Google Fonts loader failure also affected deployment; the Turbopack production build avoids that loader path while retaining all existing font definitions. The shared sender display name and address are now JKTL Business and notifications@mail.jktl.com.ng. Previous jktl-business@mail.jktl.com.ng environment values are also mapped to this sender.


## Event-driven completion update — 8 November 2026

Migration 075 feeds publication, first chatbot enquiry, payment-failure and consented plan-exploration signals into this same queue. Setup reminders, pauses, cooldowns and provider-review safeguards remain in force. See [Growth completion](GROWTH_COMPLETION.md) for eligibility, human fallback and release checks. Prepared locally; no production migration or customer dispatch was performed during the deployment hold.
