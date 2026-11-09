# JKTL growth, revenue and profitability implementation

Date: 9 November 2026. Status: local implementation; migration 076 has not been applied to production. No live charges, refunds, transfers, emails, publishing operations or deployments were performed for this work.

Read [the initial audit](PROFITABILITY_AUDIT.md) for the reused architecture and confirmed pricing arrangement.

## Where the features live

Use the existing Team workspace → Insights (`/admin/insights`). There is no additional analytics application, payment provider, customer wallet or ORM.

- Executive inventory: registered businesses, period registrations, primary/additional/connected Custom websites, published websites, free website accounts, covered paying customers/services.
- Existing company MRR/ARR, product mix, receipts, receivables, acquisition costs and recurring movements remain in the same dashboard.
- Merchant payments: verified live NGN principal (GPV), payer total, successful transactions, gross/earned/held/reversed JKTL fees, processor costs, missing evidence, contribution, refunds/disputes and pending/failed checkout attempts. Charts group by day, Monday-based week, month or year.
- Company expenses: manual entry and CSV/JSON import, categories, original currency/explicit FX, evidence references, append-only reversals, exact-period completeness confirmations.
- Activation: all eleven requested first-observed stages, a separate consenting-gallery cohort, qualified daily account activity and coverage warnings.
- Subscription lifecycle: verified first/renewed/higher/lower paid plan records, forward-observed failures/cancellations and separately labelled current expired/cancelled stocks.
- Retention: comparable boundary snapshots only; source MRR and period merchant fees are shown for existing first-touch referrals. Approved campaign labels provide consented UTM attribution.
- PDF/CSV: the existing immutable snapshot/report system includes the new sources and definitions. Old saved report digests remain valid. Saved exports use fresh, consistent reads; the interactive aggregate dashboard caches for up to 60 seconds.

Date presets are Today, Yesterday, Last 7 days, Last 30 days, This month, Last month, This year and Custom. Date boundaries use Africa/Lagos; the comparison interval has equal calendar-day length. Some inventory/balance/MRR tiles are current stocks, explicitly labelled, rather than historical interval counts. Subscription ARR excludes one-off receipts and merchant fees.

## Authorization

Company-wide finance reports and exports default to Owner. An Owner can grant an active Analyst read-only company finance access in Team. This is a distinct capability from the legacy operational Insights permission. Affiliate managers, support, editors, writers and Growth/Gaming roles cannot gain company finance access through a general role override.

Company costs, financial reconciliation, coverage assertions, campaign approvals and inactive fee proposals are Owner-only server actions. An Analyst's read grant does not permit financial writes. Sensitive actions authorize before reading/writing financial data; financial actions and public payment setup/verification use existing durable rate limits. Mutations append to `company_finance_audit` and invalidate the dashboard cache.

Team sign-in and denied-page routing now select a permitted destination. An Analyst awaiting approval lands on the knowledge base; an affiliate manager lands in their programme area. Tenant, partner and public endpoints do not expose the company financial report or cost records.

## Payment safeguards

The existing invoice policy remains 5,000 kobo (NGN 50), added to invoice principal. The saved merchant subaccount receives the principal through the existing Paystack split request; `bearer: account` assigns processing charges to JKTL. The shared policy constant is reused by the provider adapter and dashboard. No fee change was made.

1. Public checkout reserves a unique immutable server reference and quote for the invoice, organization, amount, fee, currency and saved subaccount.
2. Concurrent requests reuse the existing attempt. A READY attempt reuses its validated Paystack checkout URL. An initializing or timed-out request remains uncertain; it never creates an automatic replacement charge.
3. The callback verifies with Paystack on the server and checks the exact reference/invoice metadata. Only an exact successful NGN charge can enter the ledger. Pending/unknown is not described as failed or uncharged.
4. Signed webhooks enter the merchant ledger before the legacy webhook receipt gate. Transient storage failures return 503 for retry. Recognized out-of-order refunds/disputes wait for the original payment evidence. Invalid signatures return 401 before financial writes.
5. Provider reference and provider transaction ID are unique. Ledger insertion and the eligible invoice-paid transition are one SQL statement with an invoice lock. Duplicate confirmations do not send a second notification. The existing owner notification, customer receipt and PWA workflow is reused.
6. If the invoice changed after checkout, the actual charge is retained for review without silently settling the new balance. A signed mismatch is retained in the internal reconciliation queue.
7. Live, test and unknown modes are preserved. Unknown modes/costs can acquire later server-verified evidence through immutable events. Unknown/test transactions are excluded from live company GPV until qualifying live evidence exists.
8. Refunds/disputes are immutable, keyed events. An unresolved allocation holds the fee out of earned revenue. Owner reconciliation records an evidenced additional fee reversal and, where necessary, original split proof. Adjustments cannot exceed the original fee; retries of the same event do not repeat a reversal.
9. Read-only Paystack re-verification can reconcile recorded attempts, payments, mismatch issues or existing paid online-invoice references. It does not create charges or request a refund. An ambiguous provider result stays held; only an explicitly failed attempt is released for a new checkout.

GPV is invoice principal. Payer total is principal plus the existing JKTL surcharge. JKTL revenue includes only evidenced earned fees, never merchant principal. If known processing costs exceed the fee, transaction contribution is negative. Unknown costs/allocations produce an unavailable contribution.

A recorded intended split is evidence of the original request, not proof of bank settlement. Settlement is left unconfirmed. PSP contractual eligibility, actual settlements, bank statements and production reconciliation still require operational evidence.

### Native website checkout policy

The repository does not establish a separate native store-checkout integration or fee percentage. Links to existing invoice payments from websites remain INVOICE-source payments. WEBSITE-source volume is unavailable; it is not inferred from page visits or invoice statuses.

Owners can save a fixed/percentage website-checkout proposal, with a proposed payer and evidence, in the existing finance controls. It is constrained inactive in the database and is not read by payment initialization. A crafted form cannot enable it. A separate reviewed implementation and explicit fee approval are required to make such a product live.

## Company costs and financial definitions

Merchant expense/inventory tables are not JKTL operating expenses. New company cost rows have no tenant owner and can only be written through authorized company finance controls.

Seeded configurable categories cover hosting, database, storage, AI/API, email, domains, processing, support, employees/contractors, marketing, commissions, taxes and other expenses. A used category cannot change its accounting classification. Rows preserve that classification at entry.

Manual entry/import requires a date, category, positive amount, supported original currency, stable supplier/payment reference and evidence. Imports are limited to 200 rows/200 KB. NGN is stored in kobo. USD/GBP/EUR costs require an explicit NGN-per-unit rate; exact decimal half-up conversion avoids binary floating-point FX errors. No rate feed or silent currency combination was added.

Stable economic references prevent duplicated imports. Existing acquisition-spend evidence, wholesale supplier references, confirmed policy payout bank references and known merchant processing references are protected against re-entry. Administrators must use the same real-world reference consistently; the software cannot prove two unrelated free-text references describe the same supplier bill.

Original cost rows cannot be edited/deleted. A correction appends one exact compensating reversal, with an explanation and audit entry. New costs and payment events invalidate affected period coverage. Changes to joined legacy financial sources invalidate confirmations conservatively, since corrections can affect older receipts.

The company calculation uses the application's existing **recorded-receipts basis**, not full accrual accounting:

- Covered company receipts: retained, deduplicated verified website-plan/domain/business-email/Custom receipts plus evidenced legacy hosting collections, excluding demo records and unresolved receipt risk where covered by those sources.
- Company fee revenue: eligible live merchant fees after recorded reversals and unresolved-risk holds.
- Direct costs: entered direct company costs, existing matched wholesale/product costs and known merchant processor charges.
- Operating costs: entered company operating expenses plus existing acquisition spend and confirmed policy payouts.
- Gross result = covered receipts and fees − direct costs.
- Operating result = gross result − operating expenses.
- Net result = operating result − recorded taxes.
- A margin uses the corresponding available result divided by positive covered revenue. A zero denominator yields unavailable.

Gross result requires current Owner confirmation of both revenue and direct-cost coverage for the exact date range. Operating and net results additionally require operating-expense and tax completeness. Missing processing/risk evidence overrides those confirmations. An empty cost table never implies zero total company costs.

These are unaudited management results. Complete accrual recognition, cash-flow statements, receivable recognition schedules and tax returns are not claimed. Per-customer/plan contribution, LTV, burn and runway remain unavailable until an evidenced allocation/accounting method exists; shared costs are not divided equally by assumption.

## Activation, privacy and customer success

Gallery/preview/selection/registration-start signals are optional browser intents. The existing opt-in, 30-day first-party journey cookie is reused. Do Not Track and Global Privacy Control prevent collection. Raw query strings, IP addresses, reset tokens and arbitrary private URLs are not stored in the growth data.

Only exact Owner-approved UTM source/medium/campaign tuples can attach to a consenting retained journey. Raw URL parameters are not stored. The Main privacy statement and consent description now mention approved campaign labels. Existing registration binds a retained journey to the resulting organization; unknown attribution stays unknown. Campaign attribution expires with that browser journey after 30 days; historical lifetime attribution is not invented.

Authenticated milestones follow persisted actions through additive database triggers. An empty signup profile does not claim content completion. Saving real content records a first stage; repeated qualifying writes record at most one account/day in a separate activity table. This activity metric covers instrumented website/plan changes, not platform-wide MAU.

Independent stage totals must not be divided as if they represented one cohort. The separate consenting-gallery cohort requires each preceding signal; skipped steps, users entering through other routes, lost cookies and missing instrumentation are coverage gaps, not proof of abandonment. No historical first-stage events are backfilled.

The existing website checklist and onboarding remain in use. Added next steps point to receiving-bank setup, a first genuine invoice if none exists, and existing CRM follow-up. Custom projects keep their own destination, draft sites preserve the selected template, publishing remains free on eligible subdomains, the Upgrade button and published links remain visible, and a failed onboarding save does not redirect as if it succeeded.

Existing Account Journey, renewal and support queues remain the automation system. This update does not add duplicate cron jobs or dispatch a new customer campaign. Consent, cooldowns, durable leases, uncertain delivery review and human fallback continue to apply.

## Schema and rollout

`migrations/076_company_finance.sql` is additive and uses existing direct SQL. It adds merchant attempt/payment/event evidence; reconciliation issues; company costs/categories/coverage/audit; approved campaigns; first-observed funnel and qualified daily activity; forward subscription status observations; tracking installation time; and an inactive-only website fee draft.

It does not recalculate old invoices, change subscriptions/commission agreements, seed transactions or import customer costs into company accounts. Migration reapplication is tested against isolated PostgreSQL fixtures, including immutable records and existing invoice data.

The migration is included in the existing deployment prebuild list. **A normal Business build with DATABASE_URL can apply migrations.** All builds for this local task used `npm --ignore-scripts run build`, bypassing that hook. No production migration was run.

For a later explicitly authorized release:

1. Verify the actual target environment and take a restorable Neon backup/branch; record the restore procedure and owner. Test the additive migration and application against a non-production copy first.
2. Deploy migration 076 and the Business changes together through the existing release process; deploy the Main consent/UTM changes with it. Do not apply new payment code without its schema.
3. Confirm existing live-mode PSP keys/webhook URL and event subscriptions. Validate any real payment or refund only with explicit authorization and a designated recipient/business; automated tests use fixtures.
4. Check the cron authorization binding. The last release inspection found a missing production CRON_SECRET; this task did not change it. Vercel sends the configured secret in the bearer header to the existing scheduled endpoints. Verify successful execution/history before treating lifecycle/recurring snapshots as operational.
5. Monitor uncertain payment attempts, signed mismatches, refund allocations, missing processor costs and period coverage. Reconcile provider and bank statements before external reporting.
6. Record actual company costs, reviewed FX and source completeness. Grant read-only Analyst access deliberately. Generate a fresh saved report and verify its PDF/CSV before investor circulation.

No new provider keys, telemetry vendor or recurring task is required by this code. Production email, push, payment, backup/restore and webhook delivery cannot be certified by isolated fixture tests.

## Verification

- Business and Main optimized production builds/type checks pass with migration hooks disabled.
- Business ESLint passes. Main's existing `npm run lint` uses the removed `next lint` command and has no ESLint 9 config; its three changed TSX files pass the installed Next/TypeScript recommended rules using an explicit temporary config. No unrelated Main lint migration was made.
- Sixteen focused finance tests pass. PostgreSQL fixtures cover checkout concurrency/immutable quotes, duplicate/signed webhooks, delayed verification, wrong invoice/tenant/amount/currency, changed invoices, refunds/disputes and bounded replay-safe reversals, live-mode/cost evidence, expenses/FX/import deduplication, coverage invalidation, Owner/Analyst boundaries, empty-profile/content events, approved UTM attribution, inactive fee proposals and PDF/CSV generation.
- Regression suites cover existing website billing/mandates/renewals, domains, business email, receiving-bank invoicing, investor snapshots, lifecycle messages, multi-site publishing, programme intent, team permissions and Growth/Gaming authorization.
- Isolated Chromium checks pass at 1440, 390 and 320 pixels for financial charts/evidence states/CSV controls, website checklist/onboarding including failed-save recovery, and Main consent/withdrawal/privacy preferences. No live provider or customer writes were made. Screenshots are local test artifacts under `/tmp/jktl-company-finance-*.png`.

## Remaining evidence and deliberate boundaries

- Native website-store checkout and an approved active fee policy require a separate product/financial decision. The proposal stays inactive.
- Existing historical merchant payments require explicit server verification/reconciliation. Legacy split evidence and processor fees are not guessed; original settlement status remains unconfirmed.
- Actual supplier/team/tax costs and complete coverage must be supplied before profit is meaningful. Per-plan/customer cost allocation and full accrual statements need an accounting method.
- Historical funnels, cancellation events, unknown attribution and pre-installation recurring baselines cannot be recovered reliably. Retention becomes available only with sufficient real boundary snapshots.
- Subscription lifecycle event detail covers the existing website subscription ledger; cross-product recurring run-rate continues to use the existing company-recurring evidence rules. This is not a replacement billing engine.
- Live deployment/database migration, backup recovery drill, scheduled delivery and PSP settlement validation remain production-release work. No deployment or production financial mutation is included in this local update.
