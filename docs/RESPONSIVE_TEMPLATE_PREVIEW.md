# Unified responsive template preview

29 October 2026.

## Changes

Both Main and Business reuse `TemplatePreview.tsx`, `TemplatePreview.module.css`
and the existing `/templates/[slug]` and `/template-canvas/[slug]` routes. Their
new `useResponsivePreview.ts` hooks and CSS are identical, with no package or
runtime dependency between repositories. Template registries, documents,
thumbnails, metadata, canonical tags and authentication routes are unchanged.

Below Tailwind `md` (768px), CSS immediately hides device controls and makes the
iframe exactly as wide as its available container, without a minimum desktop
width, transforms, borders or a phone frame. A same-origin `ResizeObserver`
updates its natural document height so the outer page scrolls vertically. On
public previews, Back and Select Template stay pinned above the preview; space
is reserved for that bar. Main's existing body overflow styles do not interfere
with it. Desktop defaults to full width, with optional centered 390px mobile
frame and internal scrolling. `matchMedia` only listens for breakpoint crossings
and resets the desktop selection; it does not listen on every resize. The iframe
is not remounted on device changes, preserving in-frame and editor state.

The hook inspects an already-loaded document as well as future load events. This
handles cached iframe loads that occur before hydration attaches React handlers.
Cleanup removes observers, media/load listeners and pending animation frames.

Business's `TemplateCanvas.tsx` reuses these rules and its existing React portal
and `TemplateWebsite` renderer. `WebsiteDraftPreview` now delegates to that same
canvas instead of maintaining a second partner/support preview implementation.
Its read-only mode retains `sandbox="allow-same-origin"`, `inert`, no-referrer
policy/meta and the same validation of saved draft documents. Customer editing
retains its existing interactive preview behavior. The editor's wrapper border
is desktop-only. Partner/customer save, permissions and publish actions are
unchanged.

## Selection and security

Main's Select Template retains the existing
`https://business.jktl.com.ng/login?template=<id>` destination. Business login,
signup, session-only selection, onboarding and editor paths are reused. No
accounts, template records, migrations or subscriptions are created by this
change. No new cross-origin messaging, arbitrary iframe URLs, credential sharing
or sandbox-script permissions were added.

## Verification

- Both production builds, including TypeScript checks, passed.
- Focused ESLint passed for changed TypeScript/TSX in both applications. Main's
  existing `npm run lint` still invokes the removed `next lint` command, so lint
  was run directly with the available Next ESLint flat configuration; the
  unrelated project-wide lint setup was not modified.
- Existing Business website-template and partner-workspace tests passed; Main's
  SEO indexing tests passed.
- Local Chromium verified both public previews in development and production:
  320x640, 375x812, 390x844, 412x915, 667x375 landscape, 767x900, plus 768, 1280
  and 1920px desktop widths. Checks cover real iframe viewport width, natural
  outer scrolling, no horizontal overflow, hidden mobile controls, pinned
  actions, desktop/mobile switching, breakpoint reset, unchanged iframe document,
  multiple industry/landing/blank templates, Back and selected-template links.
- Production browser tests watch page errors and hydration-related console errors.
- The actual customer canvas and partner/support wrapper were exercised in a
  temporary local-only component page: mobile heights/widths, hidden controls,
  desktop toggle/reset, unchanged iframe document and preserved partner sandbox
  and inert restrictions. That temporary route was removed before production
  builds and is not part of either commit.
- Main's actual selection click was redirected to local Business for the test;
  login -> signup retained `law-firm` in URL and session storage. No account was
  created and no live customer data was used.

To repeat the public browser tests with a locally running app, Chromium and
Playwright available:

```
PREVIEW_TEST_ORIGIN=http://localhost:3101 node tests/template-preview.browser.cjs
```

Each repository contains the same browser test. Adjust the origin/port; set
`CHROMIUM_PATH` if Chromium is installed elsewhere. No testing-only route is
needed for the public test.

## Limits

Tests used Chromium viewport emulation, not physical iPhones/Android devices.
This runtime has no production database/session credentials, so real signup,
authenticated partner/client saves, subscription eligibility and live publishing
were not exercised against production. Their existing server paths were
preserved and relevant isolated database regressions passed. Independent
cross-origin template URLs cannot use this same-origin document-height observer;
the current catalog and editor use local canvases and do not need that capability.
