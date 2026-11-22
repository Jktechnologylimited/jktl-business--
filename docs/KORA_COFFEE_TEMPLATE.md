# Coffee Shop Landing Page — Kora

Original coffee-shop template based on the owner's 22 November 2026 screen recording. The recording supplies visual direction, not application code or operational instructions. Reference brand names, copy and proprietary assets are not imported.

- Catalogue ID: `kora-coffee`; category: Food & Hospitality; single landing page, as requested by the owner.
- One route with on-page menu, story, craft, gallery, FAQ and contact sections. Navigation scrolls to sections. Menu enquiry links prefill the form on the same page. The existing customer sitemap contains only the homepage; attempted subpages remain 404.
- Espresso, cream and yellow palette, self-hosted Anton display font, torn-paper transitions, local photography, Framer Motion reveals and reduced-motion support. Human photography uses the existing documented African chef asset. Still-life asset sources and licenses are recorded in `public/template-photos/coffee/sources.json`; Anton's OFL accompanies the font.
- Mirrored catalogue and renderer in Main and Business. Main preview and template-selection routes use the existing public flow. No signup is required to browse.
- Business's existing editor can change the brand, colours, copy, photographs, categories, prices and gallery. Saved sites remain on the existing document format and publishing flow; no migrations or new storage.
- Menu requests use the existing server-side public website contact action. The server resolves the published tenant, validates and rate limits the request, stores the enquiry before reporting success and notifies the owner. Coffee forms cannot initiate appointment booking or payments. Stock copy does not invent selling prices, business contact details, reviews or order confirmations.
- Preview forms explicitly report that no request was sent. Live enquiry persistence and owner notification are covered with mocked adapters; this change does not send live test emails or create customer records.

## Checks

Run from Business:

```sh
node tests/coffee-template.test.mjs
node tests/coffee-template.browser.mjs
```

The browser test expects the built Main app at `http://127.0.0.1:3317` (override `COFFEE_TEST_ORIGIN`). It checks 1440px, 390px and 320px layouts, section navigation, keyboard menu dismissal, menu filtering, inline item enquiries, native required-field validation, honest preview results and template selection. Set COFFEE_TEST_APP=business to use http://localhost:3318 for a local Business build. The localhost hostname avoids custom-domain database resolution. It captures matching catalogue thumbnails. All requests stay local.

Production builds must use credentials removed from the environment and skip Business's database-writing prebuild for local validation. Releases follow the owner's explicit deployment instruction; GitHub and Vercel record the release status.

Verified locally: Main production build (Next 16.2.9, Turbopack), Business production builds (Next 16.4.2, webpack and Turbopack), both TypeScript checks, and 49 relevant regression tests. ESLint reports no errors; the two existing image warnings in shared renderers remain. Chromium checks pass at 1440px, 390px and 320px in both apps, including inline enquiries, on-page navigation, template selection and HTTP 404 for an attempted `/menu` subpage. No live customer records, email or payment transactions were created.
