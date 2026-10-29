# Template catalog layout

29 October 2026.

The existing Main and Business `TemplateGallery` now follow the supplied visual
reference using JKTL navy, gold and cream:

- Three large screenshot previews across desktop, two at narrower container widths
  and one on phones. No outer rounded card border or duplicate hero-photo strip.
- Compact sticky Type/Industry controls, All Templates reset and search on the right.
- Industry chips and, after selecting an industry group, source-template chips.
- Edit/View actions and Info over the screenshot on desktop hover or keyboard focus.
  Phone/touch layouts show those actions beneath the image without requiring hover.
- Template titles and existing format badges sit beneath the previews.
- Info opens a native keyboard-accessible dialog using the existing registry data.
- Display order interleaves the existing source-template groups so the first rows
  show variety instead of ten consecutive editions of one design.

The registry, template IDs, images, preview routes, published customer websites
and authentication remain unchanged. Public View links stay on `/templates/<id>`.
Public Edit/Select links carry the ID to Business login; authenticated customer
catalogs retain the existing direct editor path. Search, industry, source, type,
blank templates, empty states, reset and pagination continue to work.

`TemplateGallery.tsx` and `TemplateGallery.module.css` are identical in both
repositories. Main's existing MarketingShell supplies its 68px header offset;
scoped `:has([data-template-catalog])` rules use horizontal clipping to allow the
catalog toolbar to stick under that header. Other pages retain their overflow
rules. Business needs no fixed-header offset.

Verification:

- Browser checks on both apps: three columns at 1440/1920px, source variety,
  overlay and keyboard/touch actions, Info close/Escape, public preview and edit
  destinations, industry/source/type/blank/search/reset filters, pagination,
  sticky toolbar, a 720px dashboard container, 320/390/412px layouts and no
  hydration errors.
- Browser tests seed the existing PWA guide's dismissed reminder state to isolate
  catalog interactions. The product's install prompt behavior is unchanged.
- SSR checks cover public versus authenticated editor destinations and paired
  source/style consistency. Existing template and SEO regressions are included.
- Production builds include TypeScript checks. Focused lint retains the existing
  advisory for configurable thumbnail `<img>` elements; there are no lint errors.

Repeat public browser checks with a locally running app, Playwright and Chromium:

```
PREVIEW_TEST_ORIGIN=http://localhost:3101 node tests/template-catalog.browser.cjs
```

No database migration, new environment variable, dependency or template record
was introduced.
