# JKTL branding, domain resale, languages and website upgrades

## Brand and page structure

The platform UI uses JKTL's existing navy (`#060E2A`, `#112055`), gold (`#C9A84C`) and cream palette. This applies to the recent homepage, pricing, signup, browsing and preview controls. Individual website designs keep their own editable palettes.

“See what’s possible” is on the Main pricing page immediately after “A strong foundation for your business online.” It is no longer on the homepage. Framer Motion, pause/hover/focus behaviour and reduced-motion support are retained. Website setup steps remain on the homepage.

Each of the 33 Product, Solutions and Resources menu items has a distinct public destination. Twenty-three purpose-specific product, solution and resource detail pages are added, alongside existing template, landing-page, domain, email, company, industry and pricing pages. The page catalogue is `data/feature-pages.ts`, links are `data/navigation.ts`, and generated routes have canonical metadata, sitemap inclusion and real 404s for unknown slugs. Public help guides do not require an account; account-specific help remains available inside Business.

## Go54 domain resale

`/products/domains` focuses on `.com.ng`, `.ng` and `.name.ng`, with Nigerian, generic and country-code extension categories. The catalogue also describes eligibility-sensitive Nigerian extensions and country-specific choices. A suggested domain is **not** an availability result, reservation or confirmed registration.

The operational flow is: choose a name and extension → request availability and quote → JKTL confirms Go54 support, availability, registry requirements, registration and renewal costs → customer payment is arranged after confirmation → JKTL manually fulfils and connects the domain through Go54. Transfers and renewals can be requested separately. Website hosting is already included in JKTL website plans; it is never billed a second time as a domain add-on.

`POST /api/domains/request` validates the origin, input size, ASCII domain label, allowlisted extension, service, one-year request and contact details. Successful requests go through the existing `service_inquiries`/Command Centre pipeline with `source=domain-reseller`, `provider=Go54`, `provisioningStatus=requested` and `availability=unconfirmed`. Save failures preserve the form and show an error. No payment, email or registrar call is made by this endpoint.

Optional Main deployment variable `DOMAIN_RETAIL_PRICES_JSON` supplies **public retail prices**, not registrar credentials. It is an object keyed by an allowlisted extension, with `currency: "NGN"`, positive integer `registrationKobo` and `renewalKobo`, and optional positive `transferKobo`. Amounts are in kobo. Unsupported currencies/extensions, invalid values and malformed JSON are ignored; missing prices show quote-only copy. Provide verified current retail rates and rebuild to update static pricing. Annual renewal prices are shown separately from first-year registration. Premium names, registry support, taxes and final totals are confirmed in the quote.

Go54's public site returned a proxy 403 in this workspace. No reseller API protocol, wholesale rates or live registrar availability could be verified. No automated Go54 registration or checkout is advertised or enabled. Production automation needs the actual reseller agreement, supported API documentation and securely configured credentials. The existing Main database connection and service_inquiries schema are needed to store requests; no new database migration is introduced here.

## Hausa, Igbo and Yorùbá

Both apps share `lib/languages.ts` (Business: `src/lib/languages.ts`) and the same client language provider. English, Hausa (`ha`), Igbo (`ig`) and Yorùbá (`yo`) are selectable. Dictionaries cover navigation, authentication, core business/dashboard controls, website browsing/editor labels, pricing, domain discovery, new detail-page headings and native purpose summaries. Uncovered copy falls back to English; this is a maintained message catalogue, not an external machine-translation widget. Existing legal/long-form copy may remain English. Website/customer/business data, template IDs, prices, email/domain values and saved documents are never translated.

Preference is stored in `jktl_language`, with a one-year first-party cookie and a localStorage fallback. On production JKTL hosts the Secure, SameSite=Lax cookie is scoped to `.jktl.com.ng`, so it carries between Main and Business. Localhost uses a host cookie. Invalid language values are rejected. Switching updates rendered labels and document language without a reload, preserving input values, selection and radio state. Preview/published website content retains its own document language. English canonical URLs and metadata remain; no untranslated hreflang URLs are invented.

Main has a header selector; Business exposes selectors on signup/login, public pricing/templates and desktop/mobile workspace navigation. Native language names remain visible so the customer can return to English.

## Upgrading an existing website

Billing never creates, replaces or republishes a website document. The Business plan page prioritises the active pending editor selection over an older saved design. Its main links say “Continue editing your website” and return directly to that template; an account without a selection returns to its website workspace. Browsing other designs remains optional, not an upgrade prerequisite.

`template-selection.ts` stores a session-only editor draft keyed by organization and template. It expires after 24 hours and is restored only against the same saved website revision; the editor validates the document before using it. A stale or cross-organization draft is ignored. This preserves unsaved edits when navigating to a plan and back, including after leaving for payment, without an implicit save or publication. Internal links use Next navigation to retain workspace state. Successful plan changes do not alter the selected design or saved revision.

## Validation

Both production builds and the Business 521-test suite passed. Focused tests cover native message lookup/fallback, unsupported language values, tenant/revision draft isolation, domain input/pricing validation, request-origin and save failures, and distinct menu destinations. Browser checks cover all linked public pages and sitemap/404s, navy/gold colours, pricing section order, domain enquiry success/error states using mocked storage responses, cross-app language persistence, form preservation, a saved design A → unsaved design B → plan selection → editor B round trip, and 390px/320px layouts. No real account, domain registration, payment or enquiry was submitted. Targeted ESLint passes with the existing native-thumbnail image warning. Production deployment and Go54 fulfilment are not independently verified.
