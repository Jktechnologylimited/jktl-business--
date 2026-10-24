# Website subscriptions, guarantee and acquisition flow

## Website plans

Free, Starter, Growth, Business and Business Elite use the shared NGN catalogue in `lib/website-pricing.ts` (Business: `src/lib/website-pricing.ts`). Yearly is the default, monthly remains available, exact totals and annual savings are visible. Marketing repeats **Start for free**, without Get Started / Discuss this plan buttons on plan cards. In Business, owner-controlled radio selection leads to an explicit checkout review and recurring-billing consent.

Paid website checkout is now implemented at `/business/plans` via versioned Paystack monthly/annual plans. The owner reviews current capabilities, amount, currency, interval, renewal consent and the guarantee before opening hosted checkout. Free never calls Paystack. New plan codes are provisioned/cached server-side per business, so the same Paystack customer/email owning several businesses cannot cause subscription events to bind to the wrong tenant; legacy plans are never mutated. Existing paid legacy or bundled AI customers are directed to a migration conversation rather than sold a second overlapping website subscription.

## Access and safeguards

- Prices and currency are server-derived; payment verification checks immutable checkout metadata, organization, provider plan code (when returned), amount, currency, transaction identity and dates.
- An explicit recurring-terms acceptance is required server-side; the consent time and policy version are saved with the checkout. A database unique partial index allows one pending checkout per organization. Repeated requests resume the same URL/reference. Unknown provider outcomes stay pending and can be checked using the reference, rather than starting another potential charge. Provider requests have a 20-second timeout. Never clear a pending checkout in support tooling until Paystack has reconciled its reference.
- A unique provider transaction/reference ledger and its entitlement update execute in one SQL statement. Duplicate charge notifications/callbacks cannot extend or activate a plan twice. Signed webhooks retry with 503 if fulfilment fails; receipt failures fail closed, and failed receipts are released for retry. Legacy billing handlers remain in place.
- Paystack controls automatic monthly/annual collection. Signed subscription events attach provider subscription controls and authoritative renewal dates. Signed payment failure events surface past-due status. Card management uses Paystack's hosted manager; no card data is stored by the new code.
- Cancellation stops provider renewal and preserves the paid period. Upgrades/downgrades are scheduled for the period end: stop the old subscription renewal, save the next choice, and require the owner to return and confirm a new paid checkout after expiry. There is no immediate prorated upgrade and no automatic charge at a new price. The UI explains this before scheduling.
- Current paid capabilities: custom domain connection, template-site branding removal, SEO, existing website metrics and bounded image storage. Collaborators including owner: 2 / 5 / 10 / 25. Image storage: 1 / 5 / 15 / 30 GiB respectively (shown to customers as GB). New paid subscriptions have hard upload caps with no automatic storage overage charges. Existing customers' storage contracts are unchanged. Collaborator caps govern new additions; existing member accounts and data are not silently deactivated when a plan ends or changes. Team inserts use an organization row lock and a conditional insert in one transaction; owner-only team management and cross-tenant conflict guards prevent role/tenant escalation.
- Existing core business tools and access to all designs remain available. Advanced location/AI/workflow/CRM/e-commerce allowances are clearly marked as coming later and not activated by the payment. No unlimited AI or provisional receptionist price is sold.

## 14-day money-back guarantee

Marketing, pricing, checkout review and `/terms#website-guarantee` state the same policy: full refund of the **first website-plan payment** if the owner requests it within 14 days, monthly or yearly. Renewals, domains, email, usage, AI contracts and custom projects are separately scoped and excluded; statutory rights remain unchanged.

The owner submits a reason in `/business/plans`. Eligibility is checked against the first successful payment and database time, and a unique refund request is saved. The customer can see its status. The owner-only admin queue is `/admin/website-refunds`, also in admin navigation. JKTL billing staff stop the website subscription renewal and process the full refund in the Paystack dashboard using the exact transaction/reference shown. The signed `refund.processed` webhook marks the request refunded and ends paid website capabilities. Refunds are **manually processed**, not automatically issued by clicking Request. Original payment-method/provider processing times apply.

## Database and configuration

Migration `031_website_plan_billing.sql` is additive and rerunnable. `npm run build` applies migrations 029–031 through the existing prebuild hook when `DATABASE_URL` is bound; `npm run db:migrate` also applies it. No legacy infrastructure or AI subscription table is rewritten.

Use server-only `DATABASE_URL` and `PAYSTACK_SECRET_KEY`. `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_ROOT_DOMAIN` define the hosted return URL. Configure Paystack webhooks at `https://business.jktl.com.ng/api/webhooks/paystack` for `charge.success`, `subscription.create`, `invoice.payment_failed`, `subscription.disable`, `subscription.not_renew` and `refund.processed`. Paystack plans are generated as `JKTL Website v1 <plan> <interval> NGN <kobo> <tenant-hash>`; future price changes require a new version and grandfathering, never silent changes to an existing provider plan or quote. No exchange rates are invented.

The current local execution process has neither database nor Paystack credentials bound. Local verification uses real PostgreSQL-compatible PGlite with the actual migrations/SQL and signed provider fixtures; it does not make a live charge or claim production migration/deployment. A real Paystack sandbox purchase, renewal, cancellation and refund should be verified using deployment bindings before treating the integration as live.

## Marketing and assets

The homepage places the hook and Start for free button before a locally served, generated editorial image of a smiling African entrepreneur and colleagues. The image is illustrative brand photography, not a testimonial, employee portrait or customer endorsement. Original asset: `public/brand/entrepreneur-studio.png`.

Four concrete steps cover templates → free account and editing → publishing → optional domain/email/paid plan. Eight example template cards move using Framer Motion, pause on hover/focus or button click, and respect reduced-motion settings. Existing business tools, product pages, template rendering, desktop/mobile toggles and genuine-review rules remain in place.

## Validation

Both production builds passed. The final Business full suite passed 516 tests, including all seven focused billing scenarios, the actual checkout action and two businesses sharing an email/customer. Browser verification covers hook/image order, local photo loading, CTA changes, four setup steps, card movement/pause/reduced motion, NGN monthly prices, guarantee terms, demo-safe plan selection and mobile overflow. Targeted ESLint passed using the paired config for Main. Live provider/deployment verification is not claimed.
