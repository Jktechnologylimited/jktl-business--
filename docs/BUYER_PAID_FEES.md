# Buyer-paid merchant transaction fees

Implementation date: 9 November 2026 (WAT). Local changes only. Neither this migration nor a live fee-policy activation has been executed against production.

## Audit and scope

The existing merchant payment path is a Paystack invoice payment link at `/pay/[id]`. The app previously added a fixed 5,000-kobo (NGN 50) platform surcharge and initialized Paystack with the merchant's verified subaccount, `transaction_charge` equal to the platform fee and `bearer: account`. JKTL bears processor charges under that request arrangement. Invoice creation requires verified receiving-bank details and does not itself charge a fee or require a paid website subscription.

The previous local release added immutable merchant payment/attempt/event evidence in migration 076. This change reuses that ledger, the same provider, existing invoice/receipt emails, PWA notifications, company Insights and authorization. It does not create another payment module, wallet, provider, campaign system or accounting application.

There is no native shopping-cart checkout in the current repository. Existing websites can share the same invoice payment links. JKTL's subscription, infrastructure, domain, business-email and Custom-project billing are separate company payment paths and remain outside this merchant policy. Their prices, mandates, agreements and provider requests have not been modified.

## Configurable proposal

The seeded draft contains these NGN bands, in integer kobo:

| Merchant principal | Buyer-paid JKTL fee |
| --- | --- |
| Below NGN 5,000 | NGN 0 |
| NGN 5,000 to NGN 49,999.99 | NGN 100 |
| NGN 50,000 and above | NGN 200 |

The band is selected from the underlying merchant principal, not the principal plus the fee. One fee applies per eligible successful payment, not per line item. A multi-item order adapter must pass its authoritative total once. The same pure server policy supports INVOICE and WEBSITE merchant sources; it is connected to the existing invoice route, not to an invented cart.

Owners manage the proposal under the existing Team workspace → Insights → Company costs, payment reconciliation & period coverage → Buyer-paid transaction fees. They can:

- Create immutable named policy versions with configurable thresholds and flat fees.
- Choose eligible merchant sources and exempt existing businesses.
- Prepare an enabled or zero-fee version without activating it.
- Review the saved bands and audit history of earlier versions.
- Approve a selected version with provider-test and requirements/activation evidence, only when the secure deployment gate permits it.
- Roll future checkouts back to the legacy invoice arrangement using an explicit confirmation and revision check.

The prior generic inactive website-fee proposal UI is replaced by these centralized controls. Its old table/records remain intact for compatibility; they are not consulted when quoting payments. No proposal is automatically activated by a migration, draft save, email, page view or deployment.

## Activation controls and rollback

Effective policy selection requires BOTH an explicitly approved database configuration and a matching secure deployment gate:

- Isolated test deployment: Paystack `sk_test_…` key and `JKTL_BUYER_FEES_TEST_MODE=true`.
- Explicitly authorized live deployment: Paystack `sk_live_…` key and `JKTL_BUYER_PAID_FEES_APPROVED=true`.

Do not enable the live gate until JKTL has approved activation and the provider arrangement, surcharge requirements and test settlements have been verified. None of these variables were added or changed for this task. No Paystack credential was available to perform provider-hosted testing.

An Owner must separately select/approve the version, supply the evidence and confirm the tested disclosures/split. Concurrent configuration changes are rejected by the revision check. A crafted form cannot enable live charging without the secure gate. Policy rows are immutable; later changes create a new version.

Until those conditions are met, future invoice quotes retain the existing fixed NGN 50 arrangement. The proposed NGN 0/100/200 rates are therefore **not active by default**. This preserves current behavior rather than silently turning an inactive proposal into a new charge policy.

Disabling an approved policy applies zero platform fee to future merchant quotes. A rollback instead clears the active pointer and restores the legacy fixed invoice fee. Removing the deployment gate also restores that legacy arrangement for future quotes. These are different operations and are labelled separately. An already issued quote keeps its original amount/fee/version through either operation; do not blindly reprice an unresolved provider checkout.

The public disclosure endpoint is `GET /api/public/transaction-fees`. It returns a schedule only for an approved live configuration and the currently supported invoice channel. Test proposals are not published. Exempt business IDs, credentials, provider evidence, processor costs and company financial data are never included. A native WEBSITE-only proposal does not advertise a fee on invoice payments. Main consumes this public response for display only, with bounded caching; checkout remains authoritative.

## Buyer and invoice behavior

The invoice document continues to show its original subtotal, discounts, principal and outstanding principal. Existing taxes, delivery or merchant charges remain invoice line items; this implementation does not invent tax/shipping calculations.

A separate checkout section displays the selected merchant payment, JKTL platform fee, zero additional buyer processor surcharge and final buyer total before confirmation. Buyers may choose part or all of the outstanding principal. Changes request a fresh authoritative server quote. A fingerprint binds the invoice total, prior principal received, selected payment, fee/version and receiving subaccount. A stale/missing confirmation token cannot start a payment silently.

The existing durable reservation keeps one active attempt per invoice. Concurrent clicks reuse the quote/reference. An uncertain or timed-out initialization does not start a replacement charge. A known issued quote is reused even if a newer fee version is approved. If the invoice total or receiving account changes after checkout, the request is held for reconciliation.

After trusted server verification or a valid signed webhook:

- The exact quoted NGN amount, currency, invoice, organization and provider reference must match.
- Principal and fee enter separate immutable ledger fields, together with the fee version/snapshot and known provider processing cost.
- Only the verified principal credits `online_received_kobo`.
- A partial invoice remains pending/overdue until all principal is settled. Fees are charged on each eligible successful payment's principal.
- The invoice's original total never increases because of JKTL charges.
- Replays cannot credit principal or send notifications twice. A changed invoice retains the real charge as review evidence without silently applying it to the wrong balance.
- Existing receipts and owner emails describe the actual payment, the buyer fee/total and any remaining principal. A partial receipt does not claim the invoice is settled. Final invoice-paid PWA notification is sent only once the invoice is fully settled.

The callback links back to the receipt and remaining balance. Public invoice pages show verified receipt history without revealing internal processor costs or company revenue. Manual completion preserves any already-evidenced partial online fees; it does not retroactively rewrite the immutable payment ledger.

Refunds/chargebacks reuse migration 076's signed immutable events, duplicate protection, out-of-order retry behavior and bounded compensating fee adjustments. Fees remain held while refund/dispute allocation is unresolved. No automatic proportional fee-retention/refund rule is assumed: the policy explicitly requires provider evidence. Refund evidence does not silently create another charge or reopen a settled invoice; the existing controlled reconciliation/refund workflow remains the authority.

## Merchant and company views

Businesses have `/business/payments`, linked from the Money navigation and invoice screens. It shows only the current authorized organization’s payment attempts and verified payments, with date/status filters, principal, buyer fee/total, refund evidence and settlement status. Owner/manager authorization is checked on the server. Failed or unknown verification does not become earned revenue. A successful payment is distinct from a confirmed bank credit.

Company Insights adds a transaction explorer with date, status, source, provider and business filters, transaction details, volume by business and earned fee revenue by source. The existing daily/week/month/year chart and immutable report exports use the same merchant ledger. Demo and non-live evidence are excluded from financial GPV aggregates; uncertain processing/risk information stays explicit. Existing Owner/explicit Analyst finance-read rules remain in force. Policy writes remain Owner-only.

The buyer surcharge is JKTL fee evidence, not merchant sales. GPV is merchant principal. Company net earned fees include only eligible live verified fees after evidenced reversals/holds. Processor costs can exceed the fee and yield negative contribution; they are not silently deducted from the merchant or passed to the buyer by this code.

## Provider documentation and unverified points

Official public sources inspected on 9 November 2026:

- https://paystack.com/docs/payments/split-payments/
- https://paystack.com/pricing

Paystack documents `subaccount`, flat `transaction_charge`, and the main account bearing processing costs by default. It documents changing the bearer to the subaccount and warns about insufficient split allocations. The existing `bearer: account` request is preserved; the application does not invent a buyer processor-fee API field or gross-up formula.

The public Nigeria pricing page lists local processing as 1.5% + NGN 100, the NGN 100 component waived below NGN 2,500 and a NGN 2,000 local cap; international/channel pricing differs. These published figures are audit context, **not a newly hardcoded processor calculator or permission to pass charges through**. For many amounts the proposed NGN 100/200 fee does not cover processing. The actual account's contract/channel treatment and a zero/small main-account share need explicit provider validation.

Automated SDK tests inspect the existing request fields. Synthetic provider fixtures verify math, state transitions and records. They do not prove that Paystack will accept the arrangement or settle the intended amounts in a real account.

Before live activation, confirm:

1. Provider permission and applicable surcharge/disclosure requirements for this account and customer channels.
2. Test-key split outcomes, including zero-fee low-value payments, positive bands, local/international channels and insufficient-main-share handling.
3. Actual provider transaction/settlement details, merchant allocation and the processing-cost bearer.
4. Permitted fee treatment on full/partial refunds and chargebacks.
5. JKTL's explicit live authorization, production webhook configuration, secure keys and a reviewed rollback procedure.

No provider-hosted test, live charge, refund, transfer, bulk email or production financial mutation was performed.

## Database and release

Additive migration 077 adds immutable fee-policy versions, an approved configuration pointer, invoice online-principal credit, and fee-policy/snapshot/initial-balance columns on the existing attempt/payment ledger. It seeds only the unselected proposal. It does not rewrite old fees, invoices, provider references or payment history. Invoice guards prevent reducing a total below verified principal already received and prevent credit removal/overpayment.

Migration 077 depends on local migration 076. Both must be included in the next explicitly authorized release; neither has been applied to production during this work. The existing prebuild migration list includes 077. All local builds here use `npm --ignore-scripts run build` to skip migration hooks.

Take a recoverable database backup/branch and validate the combined migration on a non-production copy before the eventual release. Reapplying 077 and immutable-policy behavior are tested in isolated PostgreSQL. Deploying code/schema does not itself activate the proposed policy; secure gate plus recorded approval are still required.

## Verification

- Nine focused tests pass for requested boundaries, aggregate multi-item principal math, company-payment exemptions, gates/authorization, immutable policy changes, full/partial invoice credits, stale quote protection, rollback, concurrency/timeouts, delayed verification, wrong amounts/currencies/tenants, full/partial refunds and disputes, tenant-scoped reporting, safe product intents and public-disclosure privacy.
- Existing sixteen company-finance tests pass. Website billing (seven), business email (eighteen), domains (twenty-one), receiving-bank/invoice/receipt tests (eight), subscription-intent and SQL-statement tests pass with isolated fixtures.
- Chromium checks pass at 1440, 390 and 320 pixels for buyer charge disclosure, partial re-quotes, explicit confirmation, draft editing and locked activation. Existing finance, invoice creation (including dark mode) and onboarding browser regressions pass.
- Optimized builds/type checks and lint of changed production source are run locally. A full-repository ESLint invocation also exposes pre-existing CommonJS browser-fixture lint rules, a legacy template-test variable rule and an unrelated domain component's unescaped apostrophe; those are not hidden by changing the lint configuration.

The companion Main repositioning report is in `jktl-main/docs/REPOSITIONING.md`. Deployment remains paused.
