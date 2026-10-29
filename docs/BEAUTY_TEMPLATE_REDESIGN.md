# Versioned multipage salon template

29 October 2026.

## Result and scope

The existing `hair-salon` template ID now offers an original luxury editorial
salon design on Main and Business. The catalogue still contains 200 designed
entries plus two blanks. Other beauty editions remain distinct and unchanged.
No Wix code, branding or imagery is incorporated. The supplied Wix reference
page was readable (HTTP 200); the original direction uses warm ivory, espresso,
bronze, serif headings, spacious layouts and locally bundled licensed stock
photography. Hover effects respect reduced-motion preferences.

Preview: `/templates/hair-salon` on either application. No signup is needed to
browse any page. Select Template still uses the existing Business login/signup
flow and preserves `template=hair-salon`.

## Actual routes

The same navigation works inside the existing responsive iframe preview, in the
CMS canvas, and on a published customer hostname:

| Page | Customer path | Existing public preview prefix |
| --- | --- | --- |
| Home | `/` | `/template-canvas/hair-salon` |
| About / team | `/about` | `/template-canvas/hair-salon/about` |
| Services | `/services` | `/template-canvas/hair-salon/services` |
| Cut & finish | `/services/cut-and-finish` | Same suffix after the preview prefix |
| Colour & gloss | `/services/colour-and-gloss` | Same suffix |
| Texture & care | `/services/texture-and-care` | Same suffix |
| Occasion styling | `/services/occasion-styling` | Same suffix |
| Gallery | `/gallery` | `/template-canvas/hair-salon/gallery` |
| Appointment request | `/book` | `/template-canvas/hair-salon/book` |
| Contact | `/contact` | `/template-canvas/hair-salon/contact` |

These are actual independent routes, not anchors posing as pages. Published
service routes are derived from the saved document, so edited/new services appear
in navigation and sitemap without rebuilding the registry. Unknown routes return
404. Preview routes remain intentionally noindex, and the public preview shell
is preserved on nested routes.

## Existing customer protection

The outer document version remains `1`; the optional design marker is
`beauty.version = 2`. Only new catalogue drafts acquire it. Saved salon documents
without that marker keep the original single-page renderer and content. No
customer records are migrated or overwritten on deployment.

Owners and authorized partners can explicitly choose **Preview updated salon
design** for an old salon draft. This adds the versioned design settings while
retaining existing copy, photos and services. New sample sections stay labelled.
Existing save/publish actions, optimistic revisions, membership checks, Partner
scopes, subscription checks and publication state remain authoritative. Merely
previewing or editing does not publish anything.

## CMS

The existing editor and Partner/support `WebsiteFields` now include a shared
`BeautyFields` section. It covers team profiles, philosophy, opening hours,
phone/email/address/WhatsApp/map destination, detailed service slugs/categories/
duration/display prices/images/benefits/preparation, gallery categories and
page-specific SEO. Existing fields continue to edit business name, logo, brand
colours, hero/about/contact copy, images, gallery, socials and testimonials. The
home search fields and page SEO editor update the same home metadata.

Input is validated by the existing shared document parser: allowed design version,
bounded text/lists, HTTPS or explicitly allowed bundled assets, email/phone formats,
valid unique service slugs and valid unique SEO page paths. Tenant-specific
canonical hosts are computed by the server rather than accepted from the CMS.

Demo prices, testimonials, team and stock imagery are labelled as editable sample
content. The owner controls that label after replacing samples with genuine
information. No review/aggregate-rating structured data is fabricated.

## Requests, bookings and notifications

Preview forms explicitly say they do not submit anything. They never show a fake
success. Published forms validate name, email, phone, service/date/time where
applicable, and messages server-side. Appointment times are interpreted in WAT,
not the visitor device timezone; invalid/past/out-of-range dates are rejected.

- A request that matches an active Business service uses the existing public
  booking action. It rechecks tenant/service ownership and uses authoritative
  service pricing, never the template's demonstration/display price.
- Contact enquiries and appointments without a configured matching booking service
  are saved as customer enquiries in **Customers**, with the request details in
  notes. They are not represented as confirmed reservations.
- Success is shown only after storage succeeds. The existing branded email sender
  notifies the actual organization owner's email; the visitor cannot choose a
  notification recipient. Notification failure does not discard the saved request.
- The existing rate-limit store protects IP, organization and email buckets; IP
  and email identifiers are hashed in those rate keys. A honeypot helps reject
  automated submissions. These forms do not create marketing consent.

Real salon contact actions appear only when their details are provided; no fake
phone numbers or mailboxes were invented. WhatsApp supports normal Nigerian
number formats. A map link is generated from the owner's address or uses an
explicit HTTPS map destination. No scheduling platform, new request database or
separate email module was created.

The existing AI/scripted chat configuration is reused on all public pages. Its
service actions navigate to the real appointment-request page. Existing published
website metrics continue to receive page views and CTA/contact interactions.

## Preview, accessibility and performance

The unified preview remains mobile-only below `md`, with hidden device controls,
actual available width and natural vertical scrolling. Desktop retains its two
modes. In the CMS, page navigation updates the same iframe/unsaved document.
Partner sandbox restrictions remain; the new design permits internal navigation
and harmless preview forms while the callback for real submission is absent.
Legacy partner previews retain their inert behavior.

The gallery has category filters and a native keyboard-accessible image dialog
with Escape/close support. Opening it safely scrolls the embedding iframe beneath
the host toolbar so the Close control remains reachable on mobile. Menus expose expanded state, links have accessible
names, forms have labels and validation, and a skip link reaches the main content.
Mobile inputs use 16px type to avoid automatic phone zoom.

Five photographs are bundled locally, each with a smaller 640px variant selected
through `srcset`/`sizes`. The hero is eager/high-priority; other images are lazy.
Explicit dimensions and CSS image containers reserve their space. No heavy new
runtime dependency or font request was introduced. The existing salon thumbnail
was refreshed in both catalogues. Tenant middleware serves public template assets
directly rather than rewriting them into customer page routes.

Stock sources (Unsplash standard license; demonstration material, not actual client
results or staff):

- `hero`: https://images.unsplash.com/photo-1531123897727-8f129e1688ce
- `interior`: https://images.unsplash.com/photo-1560066984-138dadb4c035
- `styling`: https://images.unsplash.com/photo-1580618672591-eb180b1a973f
- `colour`: https://images.unsplash.com/photo-1519699047748-de8e457a634e
- `stylist`: https://images.unsplash.com/photo-1524504388940-b1c1722653e1

## SEO

Each published page has a unique title/description, canonical URL on the verified
customer domain (or its JKTL subdomain), Open Graph metadata and semantic content.
`HairSalon` structured data uses supplied business details and excludes invented
reviews, ratings and demonstration addresses. Published `sitemap.xml` includes
only actual document paths. `robots.txt` advertises it; unpublished/prospect sites
remain excluded. Those database-dependent handlers are explicitly runtime-only.
Main catalog metadata/canonical URLs and intentional preview noindex remain intact.

## Verification and limits

- 25 Business tests passed: versioning, parser/XSS validation, all page renderers,
  genuine tenant resolution, persistence before confirmation, failure handling,
  owner notifications, authoritative booking routing, WAT conversion, sitemap,
  middleware assets, legacy compatibility, Partner permissions and shared email
  regression coverage. Main's existing SEO test passed.
- Real Chromium checked all ten routes at 390px and 1440px in both applications,
  loaded/decoded photos through natural lazy-loading behavior, responsive menus,
  navigation inside the wrapper iframe, template selection continuity, gallery
  filtering, image-dialog keyboard closure and wrapped-preview Close accessibility, preselected honest preview forms,
  intentional 404 and hydration errors.
- The actual CMS fields and read-only Partner-style canvas were tested in a
  temporary local-only component page. Edited stylists appeared on About and edited
  prices on Services; unsaved edits did not publish. That route was removed before
  production builds and is not shipped.
- TypeScript and full production builds passed independently for both apps.
  The same ten-page browser matrix is also run against the production builds.
  Focused lint has no errors; the shared configurable image renderers retain
  Next's advisory `no-img-element` warnings. Direct images support arbitrary
  owner-configured HTTPS sources; bundled default photos use responsive sizes.
- Main's legacy `npm run lint` command invokes removed `next lint`; direct ESLint
  was used with the existing paired-workspace flat configuration. No runtime/build
  dependency between repositories was added.

This workspace has no `DATABASE_URL` or `RESEND_API_KEY`. No live customer data was
changed and no real notification email was sent. Database/action tests use isolated
fixtures and mock provider calls; real deployment booking/enquiry persistence and
email delivery require a post-deployment smoke test with the existing secure
bindings. Smartphone behavior was checked in Chromium viewport emulation, not on
physical iOS/Android devices. No new environment variables or database migration
are required.

## Main files

Shared/mirrored: `lib/website-templates.ts`, `BeautyWebsite.tsx`/CSS,
`TemplateWebsite.tsx`, `TemplatePreview.tsx`, nested `template-canvas` routes,
stock photos and the existing salon thumbnail. Main also updates its existing
`MarketingShell` preview-route detection.

Business: `BeautyFields.tsx`, `TemplateEditor.tsx`, `TemplateCanvas.tsx`,
`WebsiteFields`, Partner workspace, `public-site-view.tsx`,
`public-website-request-actions.ts`, `public-pages.ts`, `public-site-assistant.ts`,
existing `email.ts`, tenant root/nested/SEO routes and middleware. Tests are
`beauty-template.test.mjs`, `beauty-template.browser.cjs` and the updated existing
`website-templates.test.mjs`.
