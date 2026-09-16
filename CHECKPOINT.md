# JKTL Business — Checkpoint 2 (full salon module set)

Builds on Checkpoint 1 (shell, auth, dashboard). This pass: real JKTL brand
mark, and every remaining salon module wired to working CRUD.

## What changed since Checkpoint 1

- **Brand mark** — replaced the placeholder generated "J" icon with the
  actual JKTL logo (uploaded), cropped to content and composited onto the
  brand-teal rounded square. Regenerated `icon-192.png`, `icon-512.png`,
  `icon-512-maskable.png`, `apple-touch-icon.png`, `favicon.png`, and added
  `public/jktl-logo.png` (transparent) for in-app use. `JktlMark` now
  renders the real logo image instead of a drawn letterform.
- **Full CRUD store** (`src/lib/store.ts`) — add/update/delete for
  customers, services, products, bookings, expenses, invoices; sale
  creation that also decrements product stock and logs an inventory
  movement automatically; manual stock adjustment.
- **Shared UI added**: `Sheet` (bottom sheet on mobile / modal on desktop),
  `ConfirmDialog`, `Toaster` + toast store, `SearchInput`, `FilterTabs`,
  `PageHeader` — every module below is built from these.
- **Every module is now real**, not a placeholder:
  - **Customers** — list, search, add/edit sheet, detail page with visit
    history (bookings + sales merged), delete.
  - **Services** — category filter tabs, add/edit, delete.
  - **Products** — search, low-stock badge inline, add/edit, delete.
  - **Bookings** — Today/Upcoming/Past/All tabs, search, quick "mark
    completed", full edit, delete.
  - **Sales** — a real line-item builder (add service/product lines, live
    subtotal/discount/total), records against the store, decrements stock.
  - **Inventory** — stock-levels tab + movements-history tab, manual
    add/remove stock with a reason logged.
  - **Expenses** — category filter tabs, running total for the filtered
    view, add/delete.
  - **Invoices** — list with status tabs, create with generic line items,
    detail page with mark-paid/mark-pending, print (via `window.print()`,
    with app chrome hidden through `print:hidden`), and copy-summary to
    clipboard.
  - **Reports** — Today/This week/This month tabs: sales, expenses, net,
    outstanding, booking-status breakdown, top services, top products,
    low-stock list. New selectors added to `selectors.ts` for all of this
    (`salesInRangeTotalKobo`, `topServicesInRange`, etc.).

## Verified

`tsc --noEmit`, `eslint`, and `npm run build` all pass clean — 21 routes (2
of them dynamic: `/business/customers/[id]`, `/business/invoices/[id]`).
As in Checkpoint 1, the build was proven with a temporary local font swap
since this sandbox can't reach `fonts.googleapis.com`; the real
Manrope/Public Sans are back in for delivery and will resolve normally
wherever this actually runs.

Two real lint issues surfaced and were fixed along the way, worth knowing
about since they reflect genuine React 19 correctness rules, not style
nitpicks: a `Date.now()` call directly in a `useState` initializer (fixed
with a lazy initializer function) and a `setState` call inside a bare
`useEffect` (removed in favor of the lazy initializer).

**Not yet done**: an actual in-browser click-through. I'd specifically
check the Sales line-item builder and the Bookings date/time picker on a
real phone before trusting this fully — those are the two most
interaction-heavy pieces and the ones I'm least able to verify without a
browser in this environment.

## Decisions worth flagging

- Invoice numbers are assigned as `INV-{count+1}` from the live invoice
  array length — fine for a demo, but will produce a collision if an
  invoice is deleted and another created after. Not a real risk until
  Phase 2 gives invoices a real sequence in Postgres.
- "Print / Download" on an invoice uses the browser's native print dialog
  (which can save as PDF) rather than a generated PDF file — genuinely
  functional, not a placeholder, but worth knowing it depends on the
  browser's print-to-PDF rather than a server-rendered PDF.
- Deleting a service or product doesn't check whether past bookings/sales
  reference it — historical records keep their own copy of the name and
  price, so nothing breaks, but there's no "can't delete, it's in use"
  guard. Reasonable for V1; worth a guard later if it matters.

## Next steps

Frontend acceptance criteria (brief Section 26) are now essentially all
met with mock data. Worth a manual click-through pass next, then it's
ready to review against "would a real salon owner in Yenagoa use this
every day" before considering Phase 2 (Neon, real auth, Resend) — which
still hasn't been started, per the brief's instruction not to start it
automatically.
