# Company Insights and investor reports

Open **Team → Insights** (`/admin/insights`). Choose a WAT date range, inspect charts, then **Generate report snapshot**. Open the saved report to download its PDF or spreadsheet-friendly CSV. Optional management notes are stored with the report. Owner and Analyst roles can generate/download reports; existing roles with view permission retain view access. Reports are private, never emailed or published automatically.

Snapshots store aggregate data and a SHA-256 digest in `investor_reports` (additive migration 071). Both downloads use that snapshot, not a fresh set of queries. Reports remain stable when live source records change. The application exposes no snapshot edit/delete action. Digest checking detects accidental payload changes; this is not a cryptographic signature or audit certification.

## What the charts measure

- Registered businesses: current `lifecycle_current` population, excluding demo/unclaimed prospect sites. Creation cohorts use organization creation dates; they are not historical active-user counts.
- Activation: current template selection/publication stages. Managed Custom clients are separate from self-serve templates.
- Receipts: verified NGN payment evidence in website plans, domains, Business Email and Custom invoice installments/legacy version-1 invoices. Deduplicated by provider transaction and payment reference. Pending/unverified evidence, demo payments, non-NGN currencies, tenant-owned sales/invoices and hypothetical AI schedules are excluded.
- Refunds/risk: recorded adjustments as of snapshot generation against the selected receipt cohort, not necessarily refunds processed within the selected period. Uncleared risk removes the remaining amount from retained receipts. Retained is before fees, tax and operating costs, not profit.
- Website MRR: current active, unexpired website subscriptions matched to the latest payment, same plan/interval, unexpired paid period and no refunds/risk. Actual annual paid amounts divided by 12. ARR is MRR × 12, not all-company revenue or a forecast.
- Website events: recorded hosted-template views, CTA/contact/booking events; repeated visits/bots may be included. External Custom websites and the marketing website are not measured.
- Game activity: accounts with their latest Tycoon save updated in the selected period. Excludes guests, other games and separate Fantasy data. Never label it MAU, sessions or retention.
- Partners: programme application counts, current NGN policy-ledger balances and confirmed period payouts. Legacy commission ledgers are excluded.
- Portfolio: current Custom projects, domain/email service records, support cases and renewal items with recorded dates.

Current-state metrics remain current even when a historical date range is selected. The comparison period has the same number of calendar days. All source aggregates are read in one repeatable-read, read-only database transaction. Missing source tables display **Unavailable**, not zero; required source gaps prevent saving a report.

## Before sending to investors

These are unaudited management reports. Live/test payment mode is not uniformly recorded: reconcile payment evidence with live provider and bank statements. Add explanatory management notes. Offline payments and standalone legacy hosting outside the covered ledgers are not included. Costs are incomplete, so profit, margin, burn and runway are intentionally unavailable. Platform-wide MAU, retention, CAC/LTV and guest-game traffic require additional measurement; the report does not invent them. Historical MRR/stage transitions are not reconstructed; save periodic snapshots going forward.

## Verification

`node tests/investor-reports.test.mjs` runs isolated PostgreSQL (PGlite) tests covering payment deduplication, refunds/risk, annual normalization, latest-refunded-payment handling, current populations, currencies, frozen JSONB snapshots/digest checks, real PDF generation, CSV escaping and private download permissions. No automated test writes production customer or payment records.

## Activation and acquisition extension — 8 November 2026

The existing Insights screen now includes a Growth & Revenue Overview, independent first-observed activation milestones, recorded referral-source performance and current Custom receivables. These are optional report sections so saved historical snapshots remain readable. Migration 074 starts forward-only milestone observation; it is prepared locally and not applied during the deployment hold. See [the activation/revenue audit](GROWTH_ACTIVATION_REVENUE.md) for definitions, implemented changes, remaining work and rollout checks. Website MRR/ARR remains conservative and separate from collections, receivables and unsupported recurring-service estimates.
