# Distribution platform implementation

## Current delivery: Stage 1 foundation only

Migration 038 adds versioned policy records, immutable legacy enrollment snapshots,
review flags and a governance audit trail. `/admin/distribution` links to existing
application/payout operations, shows imported agreements and proposed policy
versions, and lets Owner administrators create draft subscription policies or
record reconciliation notes. Existing Affiliate managers can read this page;
Support and ordinary business/affiliate sessions cannot access it.

No draft activation action exists. No participant is enrolled in the proposed
15% affiliate or 20% partner terms. Existing public offers, monetary balances,
commission records, payout schedules and authentication remain unchanged.
Replaying 038 does not refresh snapshots from changed account settings.
New accounts created under the still-live legacy offer receive an immediate
review-required snapshot through a database insert trigger. Before new-policy
activation this enrollment path must be extended to require accepted new terms.

Snapshot review is an acknowledgement of account settings only, not proof of a
signed agreement or approval to change terms. Historical terms cannot reliably
be reconstructed from current mutable account fields; all imported accounts are
flagged for review rather than assumed contractual truth.

## Inspection findings

- `affiliates`, `affiliate_sessions`, `affiliate_referrals`, `affiliate_earnings`,
  payouts, bank verification and password reset are existing systems.
- Partner applications use the same affiliates table with `programme=partner`.
  Approval and `partner_terms_confirmed` gate the existing Partner dashboard.
- Affiliate and Partner dashboards share the existing dashboard implementation.
- Existing sessions are separate from Business customer sessions; shared-account
  linking is required, rather than silently merging by unverified email.
- Existing referral acquisition is first-touch per organization, protected by a
  unique organization constraint. Any new precedence/window rule needs a cohort
  migration and must not overwrite prior eligible attribution.
- `accrueCommissionForOrg` currently calls the fixed-tier calculator regardless of
  the `commission_model` selected. This is a reconciliation issue, not grounds
  for silently rewriting existing earned amounts.
- Existing cron-based retention rewards represent legacy contractual behavior;
  do not replace them with proposed captured-payment-only rules for old cohorts.
- Existing verified bank details and manual payout request paths should be reused.
- Current public affiliate rates remain unchanged. Do not advertise new draft
  rates before accepted policy and payment integration launch together.

## Proposed calculator (not payment-connected)

`src/lib/distribution/calculation.ts` calculates safe integer minor-unit quotes
using BigInt intermediate arithmetic. Captured amount already excludes discounts;
discounts must not be deducted twice. Taxes, processing fees and pass-through
costs reduce net. Refunded, charged-back, self-referred, test or unsuccessful
payments earn zero. Currency must be explicitly eligible. A margin reserve and
maximum commission cap apply. Reseller-discount stacking is disabled unless
explicitly approved. Paid service months cap the eligible amount: annual payment
is one calculation, never twelve fictitious transactions. The caller must supply
verified actual payment facts and atomically reserve paid months/idempotency;
this pure calculator does not establish eligibility or implement a ledger.

## Remaining ordered implementation plan

1. Reconcile legacy agreement snapshots; link the authenticated Business User to
   program profiles through explicit verification, allowing multiple programs.
2. Extend application fields/statuses, accepted policy evidence and cohort
   activation dates. Owner-controlled activation must coordinate public terms.
3. Add verified captured-payment commission ledger, product rules and per-account
   agreements; currency/product disabled by default until economics are reviewed.
   Use transaction uniqueness and locked service-month allocation; refund and
   chargeback adjustments must preserve paid history and create reconciled debt
   or holds rather than silently deleting payouts.
4. Add referral event privacy/consent, 30-day signed attribution and fraud review,
   maintaining existing eligible acquisition records and self-referral protection.
5. Expand Affiliate reporting and controlled payout reservation/reconciliation.
   Preserve legacy 21st-of-month rules. No automatic bank transfers.
6. Implement hashed, expiring client invitations and client-owner consent to
   scoped partner relationships. Every action rechecks current grant and program
   status; revocation must immediately stop access. Partners never own client
   organizations or receive passwords by default.
7. Build distinct Partner client/service dashboard, agreements and reseller
   pricing. Prevent discount/commission stacking at verified order creation.
8. Marketing assets, program notifications, ledger exports and existing NEW
   registry integration, plus public launch using active-policy data only.
9. Database-concurrency, role/tenant, refund/replay, session-link, invitation,
   payout and browser tests before activating any policy.

## Validation and deployment

`node --test tests/distribution-policies.test.mjs tests/affiliate-commission.test.mjs`
uses isolated PGlite, not production money. It exercises replay preservation,
legacy immutability and calculator boundaries. Build/type/lint are separate checks.
No new environment variables. Migration 038 is included in existing prebuild.
No production migration, bank payout, notification or policy activation is part
of these checks. Full-platform launch remains blocked on the stages above.


## Follow-up delivery: account connections and partner client operations

Migration 039 adds explicit Business-user/program links. Existing approved program
accounts are connected by proving their existing program password once; email
matching alone never links accounts. Subsequent access uses the authenticated
Business user and an approved linked profile to start the existing program
session. This preserves existing credentials and permits one account per program
per Business user. It does not yet replace public application/password flows.

Business → More → Programs & partner access (`/business/distribution`) lets owners
accept private invitations, choose permissions, inspect and revoke relationships.
The invitation is retained through Business sign-in, signup and onboarding using
an allowlisted return destination. Partners use `/partners/clients` to generate
one-use links expiring in seven days, track acceptance and submit service requests.
Only hashes are stored; the generated token is returned once for private sharing.
A current approved Partner agreement is checked on every partner mutation.

Current scopes are service-summary visibility (counts only, not financial/private
records) and service-assistance requests. Neither scope lets a partner charge,
provision, edit website documents, change ownership or access customer messages.
Requests go to `/admin/distribution/requests`, where authorized distribution admins
can review/respond; completing a request is never payment or fulfillment evidence.
Revocation clears permissions, immediately blocks new service requests and removes
visibility of prior request replies from the partner view. Audit events record
invitation creation, acceptance, revocation and requests/responses.

Database-backed tests exercise non-owner rejection, invitation reuse, another
partner's denial, scoped assistance, post-revocation denial and suspension. No
invitation messages, actual customer data or live financial transactions are used.

Still outstanding from the master brief: payment-connected commission ledger,
cohort activation and accepted policy evidence, new unified application flow,
reseller prices, product economics/rules, payout reservations and reversals,
marketing assets, comprehensive program notifications and full browser verification.
Do not treat this follow-up as completion or activation of the full platform.
