# Activation and revenue update — 8 November 2026

This extends existing Business modules. No second analytics application, billing ledger, email sender or customer-success queue was created. Main's design, product routes, customer sites and payment terms are unchanged. Work is local and awaiting an explicit deployment instruction.

## Audit and implemented scope

| Area | Existing implementation | This update / remaining work |
| --- | --- | --- |
| Onboarding | Industry setup, template-intent preservation, profile fields, optional first service | Fixed a real persistence bug: phone, city and state were collected in component state but never included in `completeOnboarding`'s save. Live completion now awaits the existing profile action, installs the returned profile in the store and does not mark completion or navigate on failure. Name/phone are required before advancing. Selected template/product destinations remain intact. |
| Website activation | Free publishing, multiple sites, available-address suggestions, revision checks, template previews | Business home now shows a website checklist based on persisted site state. Drafts link directly to their existing editor (including additional-site IDs); Custom clients link to their existing portal. Published sites retain a public link, sharing action and optional upgrade. Logo/contact/WhatsApp/catalogue/enquiry steps link to existing settings rather than claiming these are completed from a button click. |
| Insights | Private, permission-guarded charts, verified receipts, website MRR/ARR, immutable PDF/CSV snapshots | Added Growth & Revenue Overview to the existing Insights screen, optional activation/acquisition/receivables sections and corresponding exports. Existing snapshots remain readable without these new sections. |
| Activation history | `lifecycle_current` gives current account status, not past transitions | Additive migration 074 records first **observed** eligible registration (active owner membership), template selection, publication and verified website-plan payment. Primary and additional sites share an account-level unique milestone. Recording runs inside the authoritative database mutation; replayed payments and repeated publishes cannot double-count an account. No fabricated historical backfill or visitor counts. |
| Acquisition | First-touch `affiliate_referrals`, verified payments, existing distribution agreements/commissions | Added per-referral-account current registrations and template publication, selected-period paying businesses, gross and retained receipts. Uses the same receipt deduplication/refund/risk handling as the financial report. Unclaimed prospects are excluded. No assumption of exactly eight sources, new commission policy or rate changes. |
| Recurring revenue | Website subscriptions matched to verified payments; annual amounts normalized over 12 months | Preserved the conservative website-only MRR/ARR definition. Collections and outstanding Custom invoices are separate. Business Email orders and Custom service schedules alone do not prove a live, accepted recurring contract; they are not silently promoted into company ARR. |
| Receivables | Versioned Custom invoices, instalments, refund review | Added current issued OPEN NGN invoice balances, overdue balances and payment-review balances. Drafts, voids, paid invoices, tenant sales invoices and unsupported currencies are excluded. Partial payments reduce the outstanding amount. |
| Payment reliability | Exact server quotes, ownership checks, verified callbacks, signed webhooks, unique provider transaction/reference, atomic entitlement updates | Existing billing regression tests were rerun, including duplicate checkout, replay, amount/currency mismatch, renewal, cancellation and refund. Updated an outdated test dependency fixture for the existing invoice payment policy; production webhook behavior was not changed. No live charge was made. |
| Retention | Account Journey 3/7-day setup nudges, 14-day human fallback, preferences, suppression, mailbox cooldown, ambiguity review; central renewal reminders | Reused, not rebuilt or reset. Growth Overview links directly to Account Journey and Renewals. First-publication congratulations, first-enquiry CRM prompts and paid-feature/payment-failure campaigns are still follow-on work; this update does not claim to implement them. |

## Reporting semantics

- Current adoption cards are stocks, not a cohort funnel. Managed Custom clients are separated from self-serve template counts. Verified active website subscriptions may include either kind of account.
- Milestone counts are independent period events for currently eligible accounts. A selection in October and publication in November are not presented as one conversion cohort. An old account can contribute a new observed publication; there is no claim to know its original publication date.
- Registration is observed when an eligible active owner membership is established, not when an unclaimed prospect organization is created.
- Payment milestones mean a verified payment was recorded. Refunds can occur later; use subscription evidence and retained receipts for current financial decisions.
- Acquisition is recorded first-touch affiliate/partner attribution only. Managed Custom clients are not counted as published hosted-template websites. Paying source counts are distinct businesses with positive retained covered receipts in the selected period.
- Visitor conversion, all-channel attribution, CAC, LTV and historical churn/upgrade MRR are unavailable without reliable source events/costs. No sample numbers are substituted.
- Company-wide ARR remains incomplete until recurring contracts, their acceptance/status, periods and settled payment evidence can be consistently reconciled across products. One-time development fees and unpaid proposals never count as ARR.
- Reports remain unaudited. Existing live/test-mode evidence limitations still apply; reconcile with provider/bank statements before investor circulation.

## Installation and verification

Migration `074_activation_milestones.sql` is included in the existing additive prebuild/migration path. Reapplying it preserves its installation timestamp and existing milestones. It does not change customer websites, orders, subscriptions or rates. **It has not been applied to the live database during this deployment hold.** Optional report sections show unavailable where tables are absent; existing core reporting remains usable.

Local production builds must skip prebuild hooks during the hold: `NODE_USE_ENV_PROXY=1 npm --ignore-scripts run build`. Do not run `db:migrate`, push a deployment-connected branch, dispatch customer mail or execute live checkout tests as part of this local review.

Isolated tests cover milestone deduplication/eligibility/no historical backfill, current draft/Custom routing, receivables with instalments and excluded records, acquisition deduplication/refunds and existing report permissions/digests/PDF/CSV. Browser fixtures render the actual onboarding, checklist and overview at 1440, 390 and 320 pixels; they verify persisted contact values, selected-template continuation, failed-save recovery, all four website states and no viewport overflow. Fixtures do not authenticate as customers or access production services.

## Remaining phased work and launch checks

1. Activation: the existing onboarding wizard still collects business details and an optional first service before its editor/checklist handoff; an embedded template chooser before details is a separate UX enhancement. True visitor-to-registration and time-to-publish cohorts need privacy-conscious event/session attribution on Main and Business. Do not infer unique visitors from template views.
2. Revenue: validate accepted recurring-contract coverage for other products, record historical plan/revenue changes for churn/expansion, consolidate acquisition costs before CAC, and verify provider/live-mode reconciliation operationally. Do not alter current entitlement or cancellation rules merely to improve a metric.
3. Retention/distribution: add consent-aware publish/enquiry/payment-failure messages to the existing durable notification system, plus outcome reporting. Existing setup and renewal sends remain controlled by current settings.
4. Operations: provider credentials, signed production webhook delivery, scheduler health, alert routing, restore-tested database backups and monitoring require deployment-level verification. This local update does not establish those external guarantees. Current free-site limits and usage quotas should receive a separate enforcement/load audit before large campaigns.
5. When deployment is explicitly authorized: apply the additive migration through the normal release, verify authenticated Insights on the deployed database, confirm the existing 21-account population and source coverage, and observe real subsequent events. Do not create fake users/payments merely to populate charts or send bulk mail to test the change.

### Local validation results

Final production Turbopack build passed with migration hooks skipped. TypeScript and scoped ESLint checks passed. The activation/revenue, investor-report, website-plan billing and lifecycle suites passed (25 tests total). Browser checks passed at all three widths, including selected-template preservation and failed-save recovery. No live database migration, provider transaction, customer email, push or deployment was performed.
