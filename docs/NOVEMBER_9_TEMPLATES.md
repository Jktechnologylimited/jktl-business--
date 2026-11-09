# Bridal and nail studio templates

Added locally on 9 November 2026. Not pushed or deployed.

| Template | Identifier | Public preview after deployment |
| --- | --- | --- |
| Bridal Beauty — Aura | `bridal-aura` | `https://jktl.com.ng/templates/bridal-aura` |
| Nail Studio — Claw Culture | `nail-culture` | `https://jktl.com.ng/templates/nail-culture` |

The two uploaded ZIPs contain nine reference screenshots each, rather than application source. These starters use original editable content and locally bundled Pexels photographs of African models, clients and artists. The reference screenshots and Wix branding are not used as website assets. Photo sources and licenses are recorded in `public/template-photos/african/sources.json` in both repositories. The bridal starter reuses reviewed bridal photographs already bundled with JKTL.

Both are full websites with nine routes: Home, About, Services, three individual service pages, Gallery, Booking and Contact. They use the existing shared catalogue, CMS document validation, public website renderer, publishing routes, request handling, template selection and responsive-preview infrastructure. No schema migration or duplicate template application is required. The catalogue contains 212 starters, including the two existing blank options.

## Editing and customer flow

- Visitors can browse public previews without signing in. Gallery cards open previews in a new tab. Select Template and the template's sign-in icon retain `?template=bridal-aura` or `?template=nail-culture` in the existing Business authentication flow.
- Business's gallery can create another website with the selected starter. Both map to the existing salon onboarding flow; selecting a template does not change an existing published website automatically.
- The existing editor controls names, logos, hero copy, colours, photos, service names/descriptions/images/pricing/duration, gallery, FAQs, hours, contact details, social links, reviews and per-page metadata.
- The bridal gallery has numbered photo controls. Service cards lead to individual pages; Request this service carries the selection into the booking form.
- Public preview forms do not send requests. Published forms reuse the existing tenant-resolved customer enquiry and owner-notification flow. A requested time remains unconfirmed until the studio agrees it; a configured real booking service uses its existing authoritative booking handler.
- Blank contact/social fields do not invent mailboxes, phone numbers, business locations or active social links. Genuine verified reviews take priority; no customer ratings or testimonials are fabricated. Sample photography is labelled as inspiration rather than the studio's actual work.
- Existing desktop preview controls switch desktop/mobile widths. On phones, the existing preview wrapper automatically uses the available screen width. Navigation and template selection remain accessible.

## Appearance and publication

Aura uses ivory, restrained type, full-width bridal photography, spacious service pages and monochrome story imagery. Claw Culture uses orange, lime, expressive headlines, close-up nail photography and a photographic gallery. Framer Motion adds restrained service/gallery hover movement; reduced-motion preferences are respected. Both use the same source and styles in Main and Business.

Customer-site metadata uses the published business's canonical host. All nine public customer routes appear in that site's existing sitemap; unknown routes remain 404. New structured data types are `BeautySalon` and `NailSalon`. Preview-indexing rules remain unchanged. No production customer sites, billing settings or previously selected templates are changed by adding these entries.

## Verification

The template/CMS/request/metadata regression suite covers all catalogue entries, round-trip editing, tenant isolation, safe publication, unconfirmed service enquiries, unique headings, customer-site canonicals/sitemaps, genuine-review handling and matching assets across repositories. Main's existing heading/SEO suite also includes the new catalogue entries.

Verification passed: 38 template/CMS/request tests, 10 Main heading/SEO tests, the final four focused starter checks, and optimized production builds/type checks for both repositories. Changed production source lint has zero errors and the two existing raw-image warnings in the shared Beauty/Template renderers. The final built-app browser run passed at all three widths in both applications, including reduced-motion hydration checks. Thumbnail captures come from the production builds, without development overlays.

`tests/occasion-template.browser.cjs` exercises both applications at 1440, 390 and 320 pixels, including service navigation, bridal photo selection, honest preview forms, sign-in selection, public gallery searches, desktop/mobile preview switching, direct page requests, unknown-route 404s and horizontal overflow. Its screenshots and logs are local under `/tmp/jktl-occasion-*`.

Optimized builds must use `npm --ignore-scripts run build` during this deployment hold so Business's existing prebuild migration hook is not executed against production. This template addition requires no new environment variables and does not activate the previously prepared payment-fee proposal.
