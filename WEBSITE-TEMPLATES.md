# JKTL website templates

Twenty original, complete industry starter websites are available through the same catalogue and renderer in Main and Business. These are not screenshots posing as editable websites, and they do not impersonate existing JKTL clients. Fictional brands, sample copy, stock image URLs and original bundled fallback artwork are explicitly marked as demonstration content.

## Gallery and editing paths

- Main `/templates`: searchable gallery with industry filters and actual preview screenshots.
- Main and Business `/templates/[slug]`: complete working website preview, with navigation, hero, about, offerings, gallery, approach, FAQ, contact section and footer. Each preview uses the actual shared renderer. Previews are not indexed.
- Gallery **View** opens the selected preview.
- Main **Edit** opens `https://business.jktl.com.ng/login?template=<slug>`.
- Login, account creation and onboarding retain that validated selection. Signed-in live users visiting the sign-in link are sent to the editor. Only known template IDs can become redirect destinations.
- Business `/business/templates`: all 20 designs within the existing authenticated platform.
- Business `/business/website/template?template=<slug>`: full section editor with an isolated, responsive live-preview canvas. Business Website settings link to the gallery and saved template editor.

Opening a template loads an **unsaved draft**. It does not overwrite an existing site. Saving uses an explicit publication toggle; turning the toggle off and saving also unpublishes the current site. Starter website content does not create or replace services, products, customers or invoices. Existing site contact information and branding are retained where appropriate.

## The 20 designs

| ID | Industry |
| --- | --- |
| law-firm | Law firms |
| church | Churches and ministries |
| school | Schools and academies |
| music-label | Music labels and artists |
| med-spa | Med spas and aesthetics |
| hair-salon | Hair salons and beauty |
| construction | Construction and engineering |
| real-estate | Real estate and property |
| restaurant | Restaurants and cafés |
| hotel | Boutique hotels |
| fashion | Fashion and clothing |
| retail | Retail and stores |
| auto-service | Auto repairs and service |
| clinic | Medical and dental practices |
| fitness | Fitness and wellness studios |
| photography | Photography and film |
| events | Events and weddings |
| travel | Travel and tours |
| consultancy | Business consultancy |
| nonprofit | Nonprofits and foundations |

The collection uses 11 compositional layout families with industry-specific copy, colours, imagery, section sequences and calls to action. The template editor controls identity, hero, colours, image URLs, about copy, offerings, gallery/captions, approach steps, FAQs and contact messaging. Email/phone/address/logo come from the business profile. This is a structured website editor, not a freeform drag-and-drop canvas. Choosing school/church templates does not claim to provision student-management or church-management software.

Existing, real service booking forms, product information and configured AI/scripted chat are retained on saved template-based public sites. Preview/demo booking controls do not submit real bookings. Businesses without a saved template continue using the original website renderer.

## Storage and deployment

Business migration `029_website_templates.sql` adds `website_template_id`, `website_document` and `website_revision` to `business_profiles`. It is additive, repeatable, and leaves existing content untouched.

Business `npm run build` now runs `scripts/prepare-website-templates.mjs` through the npm `prebuild` lifecycle. It applies **only migration 029**, atomically, using the deployment’s existing `DATABASE_URL`. TLS verification remains enabled. An actual migration failure fails the build. No credential values are logged or included in source.

If no `DATABASE_URL` is configured, the migration step explicitly skips for a demo/gallery build. Real authenticated saving requires the existing Business database. New, empty databases still require the existing `npm run db:migrate` bootstrap for the base schema. A hosting configuration that bypasses `npm run build` must apply migration 029 separately (or use the existing migration runner). Main needs no new database migration or credential for its gallery/previews.

A 64 KB schema-validated JSON document stores website-only content. Only the authenticated business owner/manager can save it. Organization identity comes from the server session, not the payload. SQL is parameterized; revision checks prevent stale template saves. Invalid image protocols, credential-bearing image URLs, unsupported document versions and oversized content are rejected. Edited text is rendered as escaped React text. Nothing is automatically published merely by choosing Edit.

Catalogue and shared renderer files are mirrored across the two repositories so each deploys independently. Business tests enforce consistency when both checkouts are present.

## Images and thumbnails

Stock photo URLs can be replaced by the owner with permitted HTTPS image URLs. Bundled original vector artwork is always available and is used automatically if a photo cannot load, including failures occurring before React hydrates. Review image permissions and replace sample material before publishing a real site.

`public/template-previews/` contains screenshots of the actual rendered designs, not unrelated sample websites. To regenerate, start Main locally and run `node scripts/build-template-previews.cjs`. In a network-restricted environment use `BUNDLED_ART_ONLY=1`; that explicitly captures the supported fallback appearance. Copy generated screenshots into Business `public/template-previews/` too. Playwright and Chromium are needed for this optional authoring tool; they are available in this cloud environment.

## Validation

- Both production builds passed, including TypeScript and generation of 20 preview routes each.
- Business `npm test` covers all existing suites plus template contracts, every template render, document validation, auth-selection handling, save action authorization, tenant isolation, persistence/reload, explicit publication, concurrency and repeatable migrations in PGlite (real PostgreSQL compiled to WASM).
- `node scripts/check-website-templates.cjs` in Main checks all 40 public previews, all 20 thumbnails, gallery filters, View/Edit links, login/signup/anonymous selection handoff, the Business gallery, demo editing/save/live iframe preview and required industry editors. It also checks mobile layouts and browser errors.
- The default browser script uses local Main port 3001 and Business `localhost:3000`. Numeric-IP Business hosts are treated as custom domains by its pre-existing production middleware.
- New template modules passed targeted ESLint with two native-image optimization warnings and no errors. Native images are intentional for editable external HTTPS sources and reliable local fallbacks.

Live database credentials are not present in this workspace. No real account, booking, email or production website was changed during tests. The additive schema was validated in PGlite; production application depends on the deployment’s existing database binding and normal build. Publishing commits is separate from confirming a successful hosting deployment.
