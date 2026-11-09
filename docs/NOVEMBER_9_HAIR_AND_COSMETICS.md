# Hair and cosmetics template additions

Local implementation, 9 November 2026. Deployment remains on hold.

| Template | Identifier | Pages |
| --- | --- | --- |
| Hair Extensions — Fiora Locks | `fiora-locks` | 10: Home, About, Services, four service-detail pages, Gallery, Booking, Contact |
| Cosmetics Boutique — Velora Beauty | `velora-cosmetics` | 15: Home, Shop, three collection categories, six product-detail pages, About, Editorial, Care, Contact |

These follow the earlier Aura Bridal and Claw Culture additions. The shared catalogue now has 214 starters, including the two blank options.

## Reference material and appearance

The uploaded `fionasalonov9.zip` contains 13 screenshot references. Fiora translates their oversized serif wordmark, monochrome portraits, hair-photo collage, quiet service index and airy gallery into an original editable site. `makeupglamnov9.zip` contains nine screenshots. Velora uses a teal/grey beauty palette, a scrolling announcement strip, a product rail, photographic category cards, burgundy editorial panels and a boutique footer.

Locally bundled Pexels photographs show African women with different complexions and hair/beauty styles; product imagery is licensed stock. The archives' browser chrome, Wix branding, fictional reviews and product claims are not published as site assets. Sources and license links are stored in `public/template-photos/african/sources.json` in both repositories. Preview thumbnails are captured from the finished local templates.

## Existing-platform integration

- Both are full websites in Main's public catalogue and Business's account-aware template gallery. They retain public previews, new-tab gallery links, the template sign-in icon, and `?template=` selection through authentication. Fiora maps to salon onboarding; Velora uses the general business setup.
- Fiora is an additional design in the existing versioned beauty document and shared studio renderer. Existing saved salon, bridal and nail documents keep their designs. Booking and contact requests use the existing tenant-resolved request/booking flow.
- Velora has an explicit `cosmetics` document design and renderer. The existing product-category/path helpers and CMS validation support it without a schema migration. Its real product pages use `/products/[slug]`; categories use `/shop/[category]`.
- The existing editor exposes branding, colours, copy, images, product categories, catalogue prices/enquiry labels, product highlights, preparation/details, gallery categories, FAQs, service areas, social links, reviews and SEO. Fiora also uses the existing studio hours/contact/service controls. No new CMS or external application is introduced.
- New draft branding is reflected in its page titles/descriptions. Published metadata uses the customer's verified host, and the existing customer sitemap includes all actual routes. Structured data uses `HairSalon` for Fiora and `Store` for Velora. Preview indexing behavior is unchanged; unknown paths remain 404.
- Published enquiry forms reuse the customer inbox and owner-notification workflow. Velora passes the selected catalogue item into the editable message and accepts contact enquiries only. Its catalogue does not introduce a native cart, stock reservation or payment/order creation. Existing configured business products and service modules remain available. Final products, shades, availability and prices must be confirmed by the merchant.
- Preview forms send nothing. No contact addresses, verified reviews, product certifications, discounts or live availability are invented. Owner-supplied verified feedback takes priority over demonstration content.

## Verification and release

Tests cover CMS round trips, all template renderers, unique headings/metadata, category and product paths, personal branding, customer-host canonicals, complete customer sitemaps, preserved older designs, tenant-scoped enquiry persistence, rejection of cosmetics appointment requests and honest preview forms. Browser checks cover desktop, phone and reduced-motion layouts, gallery searches, product-rail controls, category filtering, product searches, enquiry selection, public preview device controls and overflow.

Relevant runners are `tests/cosmetics-template.test.mjs`, `tests/occasion-template.test.mjs`, the existing template/request regressions, `tests/cosmetics-template.browser.cjs`, and `tests/occasion-template.browser.cjs` with `OCCASION_TEST_IDS=fiora-locks`.

Completed verification: 43 template/CMS/request tests and 10 Main heading/SEO tests passed. Both optimized builds/type checks passed. Changed-source lint has zero errors and two existing image warnings in shared renderers. Both templates passed all three browser widths (1440, 390, 320) in both applications; representative checks against the final production builds passed as well, including phone/reduced-motion menus, responsive preview controls, server HTML, images and zero hydration errors. Final thumbnails were captured from the production builds without development overlays. No live requests, email sends, customer publications or production database mutations were performed.

All work stays local until explicitly authorized for deployment. Build with `npm --ignore-scripts run build` during this hold to avoid Business's existing prebuild migration hook. These template additions require no database migration or new environment variables, do not publish customer websites, and do not activate the pending buyer-fee proposal.
