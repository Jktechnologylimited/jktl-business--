# Growth, revenue and profitability audit — 9 November 2026

## Reuse

Existing organization/session authorization, direct Neon SQL, tenant invoices/payment settings, Paystack signature verification, server verification, website subscription ledger, Custom invoice instalments, domain/email orders, distribution policies, Account Journey and renewal queues, template gallery/editor, private Insights with immutable PDF/CSV reports, consented browser attribution, first-touch referrals, acquisition costs and daily recurring snapshots are reusable. No new payment provider, ORM, customer wallet or separate analytics application is needed.

## Confirmed financial policy

Online tenant invoices add the existing `INVOICE_PLATFORM_FEE_KOBO=5000` (NGN 50) to the invoice principal. Paystack receives the saved merchant subaccount, `transaction_charge` equal to that fixed fee and `bearer: account`. The payer funds the surcharge; JKTL bears processor charges. The current code/config does not establish a general website-store checkout fee percentage. No new fee, rate, split or agreement will be activated.

The fee may be smaller than processor charges. This is a commercial decision for JKTL; the implementation will expose evidenced negative contribution instead of silently raising prices. PSP contractual eligibility and actual bank settlement need external verification; code inspection alone does not establish them.

## Gaps and risks

1. Merchant GPV and company fee revenue are absent from company reporting. Invoice rows alone cannot prove a live provider payment, processor charge, original split request or refund allocation.
2. Public invoice initialization has no durable checkout reservation. Timeouts and parallel requests can start multiple checkouts. Callback verification is insufficiently bound to the invoice displayed by its caller.
3. Fee/refund/chargeback financial events need append-only evidence and replay-safe reconciliation before acknowledging a webhook. Existing paid-invoice transitions and customer notifications must remain idempotent.
4. Current expense tables belong to merchant organizations. Aggregating those as JKTL operating costs would be financially wrong and leak tenant data. Company costs need a separate, protected company scope while reusing Insights, existing acquisition-spend evidence and distribution/provider cost sources.
5. Revenue is primarily verified cash receipts / covered run-rate, not a complete accrual accounting ledger. Profit must stay unavailable until the owner records period revenue, cost and tax completeness. Missing processor costs and refund allocations cannot be zero-filled.
6. Activation currently records only core milestones and consented page paths. Preview/selection/registration-start/content/checkout events and approved UTM attribution need forward-only tracking, with no historical backfill or hidden optional browser tracking.
7. Existing Insights/export access includes analyst and affiliate-manager roles. The new brief requires a dedicated company-finance capability, defaulting to Owner, for company financial/customer analytics and exports. Ordinary tenant dashboards remain unchanged.
8. The release check found missing production CRON_SECRET. This local task will not change production environment settings, dispatch mail, execute live payments, mutate production financial records or deploy.

## Implementation order

P0: immutable merchant payment/split-attempt ledger; bound verified callbacks; signature-verified webhook routing before generic receipt dedup; uncertain checkout holds and read-only reconciliation; GPV/fees separation tests.

P0/P1: expand the existing activation events and executive Insights controls, WAT presets/comparisons and subscription evidence. Reuse the existing onboarding flow and checklist.

P1/P2: company-cost categories, evidence imports and compensating corrections; explicit completeness-based profitability; channel attribution/revenue and reports; cache aggregate financial reports briefly and invalidate after administrative writes.

## Additive schema

Prepare migration 076 for merchant checkout attempts, immutable verified payment/events, company cost categories/entries, period completeness assertions and bounded optional activation events/UTMs. Preserve existing customer invoices, rates, entitlements, commissions and subscriptions. Do not migrate production until a subsequent authorized release.
