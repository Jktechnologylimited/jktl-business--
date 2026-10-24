# Website pricing and product rollout

## Shipped

- Public five-plan NGN catalogue shared by Main and Business, annual billing selected by default, monthly toggle, exact annual totals, savings and rounded effective monthly amounts.
- Growth recommended; full template catalogue available without tier restrictions. No duplicate template records.
- Public template desktop/mobile icon controls with same-origin isolated render frames. Editor has matching controls. Raw canvases are noindex and contain no marketing navigation or analytics submissions.
- Product discovery for domains/hosting, manual Zoho email, existing business tools, optional AI products and separate custom development. Included website hosting is never billed again.
- Contact requests use the existing /api/contact → service_inquiries pipeline, carrying selected product, plan and interval. Failed saves display an error and preserve inputs; no pretend success. A request does not create a subscription.
- Business Settings links to /business/plans while retaining existing subscription management, cancellation, payment history and failed-payment controls.
- Legacy billing confirmation validates currency, amount and organization. Checkout restricts owner access and refuses an existing active/past-due website subscription. Month-end renewal arithmetic clamps to the last valid calendar day; metadata-free renewals reuse the stored interval.

## Deliberately not activated

The existing paid product is Website & Hosting, plus a separate receptionist contract. There is no safe five-tier subscription migration or complete operational implementation of all requested target entitlements. New plans therefore say “Discuss this plan”, with rollout status and pending features explicitly marked. No new Paystack plans are created for Growth/Business/Elite. Existing checkout actions are not repurposed, and current users lose no features.

Outstanding before self-service tier checkout can launch:
- Persist versioned plan/interval and checkout idempotency per organization, with a transaction-safe lock for in-flight checkouts.
- Map verified Paystack plan codes to exact amounts/currencies and migrate webhook fulfilment and account management together.
- Implement and verify target branding, collaborator caps, location support, expanded CRM/e-commerce/workflows, support and metered AI allowances. Existing access needs grandfathering.
- Implement scheduled upgrade/downgrade/cancellation and real-provider sandbox verification of recurring renewals, retries and duplicate deliveries. Existing webhook receipt deduplication is not transactionally coupled to fulfilment; do not claim exactly-once new-tier billing.
- Add independent domain/email orders, provisioning statuses, annual renewals and authorized Go54 availability/registration integration. Current process remains manual quotations and existing DNS verification.
- Verify actual AI, call, SMS and telephony costs before activating any proposed ₦20,000 receptionist price. Existing contracts remain unchanged.

## Configuration

No new secrets are required for preview controls or pricing catalogue. `lib/website-pricing.ts` (Business: `src/lib/website-pricing.ts`) is the paired source for launch NGN amounts, market configuration and product positioning. Other markets require explicit prices, not converted estimates. Manual domain/email/hosting prices remain quotation-only and separate, with no invented price or charge.

Existing environment bindings remain: DATABASE_URL for enquiry storage and business records, PAYSTACK_SECRET_KEY for existing server-side billing and HMAC webhook verification, NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_ROOT_DOMAIN for deployment URLs. Configure the existing Paystack webhook endpoint as documented in its source. Never expose keys in public variables or chat.

No schema migration is needed for this release. Enquiries require the existing service_inquiries table. If the marketing database is unavailable, the form reports failure and retains direct email/WhatsApp alternatives. Provider payments and production provisioning have not been exercised by local automated tests.

## Validation

Both production builds pass. Business full suite: 508 passing tests; focused catalogue/renderer/pricing/security checks rerun after the final renderer change. Browser scripts verify all 202 previews on both apps, gallery filters, selection handoff, editor saves, metrics exclusion, device widths, responsive pricing, exact billing amounts/savings and enquiry success/error handling using mocked responses (no live enquiry sent). Targeted ESLint passes with the existing native-image performance warning; Main has no flat ESLint config, so the paired Business config was used for its changed TSX files. Provider checkout and production deployment remain unverified.
