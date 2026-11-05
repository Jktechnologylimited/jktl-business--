# JKTL Custom Project Portal

A small server SDK plus reusable Next.js/React client interface. See `docs/CUSTOM_PROJECT_PORTAL.md` in JKTL Business for API contracts, setup, permissions and cutover instructions.

Install a reviewed copy as a local dependency (`"@jktl/custom-portal": "file:vendor/jktl-custom-portal"`) or distribute internally. Keep `server.mjs`, its declaration, `ui.tsx` and `package.json` together. The UI uses Tailwind classes and inherits the host's color/font choices.

Import `createProjectPortal` from `@jktl/custom-portal/server` only inside a server-only module. Authenticate the local user and enforce explicit billing-owner permissions first. Never expose the SDK key to a Client Component. Proxy only allowed billing/invoice/payment/support paths and enforce same-origin checks on browser mutations. Forward PDF/attachment content types and disposition, never upstream credentials.

Mount `<ProjectPortal endpoint="/api/admin/jktl-portal" initialTab="billing" />` inside the authorized existing owner dashboard. Use `initialTab="invoices"` or `"support"` for dedicated pages. The endpoint is a same-origin, authenticated server proxy. The same local user ID must be mapped to the correct active JKTL organization member centrally.
