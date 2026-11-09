# Ellie Ink and Éclat Tress templates — 9 November 2026

The two supplied archives contain screenshot references, not executable projects.
Their visual direction is implemented as editable, original demonstration websites
in the existing Main and Business catalogue. Neither archive's contents are used
as implementation instructions.

## Added websites

- `ellie-ink`: cream and burgundy tattoo-artist design, large italic wordmark,
  staggered guest cards, photography mosaic and 14 real page paths. Includes
  home, about, services, three individual service pages, gallery, consultation,
  contact, aftercare, guest-visit index and three guest-detail pages.
- `eclat-tress`: white and navy hair-studio design, photographic hero, editorial
  story, service index, gallery and an accessible image-comparison slider. Ten
  real paths include four individual services and the existing enquiry pages.

The catalogue now contains 216 entries, including its two blank starting points.
These additions are websites, not landing pages. Both appear in Main's public
catalogue and Business's template selector through the shared catalogue.

## Editing and publishing

Existing website drafts, validation, save/publish actions, tenant authorization,
public-route resolution and custom-domain sitemap generation are reused. The
optional `beauty.guestSpots` and `beauty.comparison` values use existing versioned
website JSON. No database migration or new booking/payment system is introduced.

Business's existing detail editor supports adding, editing and removing guest
visits, editing their city, studio, dates, description and photograph. Each visit
has a detail page and prefills an enquiry. Changing its city/studio changes its
page URL. Guest-visit SEO titles and descriptions can be edited individually.

The hair editor supports changing both comparison photographs, labels and
caption, or disabling the comparison entirely. Removal stays removed after
parsing/saving. Default photographs compare different inspirations; they are not
presented as a client's before-and-after results. Genuine matched results may be
added by the business with appropriate permission.

Contact and consultation forms reuse the existing request handler. Preview forms
never submit a real request. Live sites save enquiries through the existing
website actions; appointments still require studio confirmation. Textarea labels
remain accessible when messages are prefilled. Genuine customer reviews take
precedence over owner-supplied reviews; neither starter invents testimonials.

Public previews need no account. Gallery View links open a new tab; Select Template
and the sign-in icon retain the template ID through the existing Business flow.
Desktop/mobile preview controls, responsive menus, reduced-motion support and
Framer Motion hover effects reuse the established template behavior.

Selected African photography is bundled locally in `public/template-photos/african`;
provenance is recorded in `sources.json`. Each website also has fallback SVG art
and a gallery thumbnail captured from the actual rendered production page.

## Verification

- 49 Business template/catalogue/validation/SSR/storage tests and 10 Main SEO tests.
- Targeted source lint and TypeScript checks in both repositories.
- Browser checks at 1440, 390 and 320 px in both apps: menus, service navigation,
  consultation preselection, honest preview forms, guest enquiry prefill, page
  metadata, 404 handling, device preview switching and image loading.
- New editor controls and comparison slider exercised through a temporary local
  fixture without creating customer records. The fixture is removed before build.
- Production builds run with npm lifecycle hooks disabled; the normal Business
  prebuild can apply migrations and is intentionally not executed locally.

All changes remain local pending the user's deployment instruction. No production
migration, customer publication, real enquiry, email, registration or payment is
performed as part of adding these templates.
