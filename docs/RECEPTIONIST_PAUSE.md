# AI receptionist product pause

The shared `src/lib/ai/availability.ts` switch deliberately pauses call recovery and automated receptionist bookings until a reviewed launch. This is independent of the platform support chatbot, customer website chatbots and ordinary manual/public booking tools.

Enforcement covers voice webhook aliases, missed-call interception, widget-session creation, chat turns (including quick-reply bookings), new receptionist checkout/top-up actions, enabling automatic charging, automatic contract collection and JKTL line-rental debits. Standalone and daily receptionist operational reminder jobs skip the paused product. Incoming verified-payment reconciliation remains available so previously captured payments are not lost. Cancellation, records and payment history are preserved.

The receptionist workspace shows an unavailable notice and a free-website destination. It is removed from active Business navigation. New payment controls are disabled in historical billing. Main's product page shows the pause, and navigation/setup messaging focuses on websites, domains and business email.

The database audit records prior activation/auto-charge flags. Both existing auto-charge flags were turned off; no contracts, customers, bookings or payment records were deleted. No provider numbers or external service contracts were cancelled. This application pause does not cancel any provider's own billing.

Before re-enabling: verify provider routing, authorization, booking ownership, duplicate prevention and spending controls; review existing contract schedules so paused months are not silently collected; obtain appropriate customer authorization before enabling charges. Do not blanket-enable stored flags. New product availability requires an explicit reviewed code change to the shared switch.

The games hub and existing Games menu lead to free websites and Main's `/tools/seo-checker`. Nigeria trends use Google's public RSS feed, with source links and a 30-minute cache. No account is needed to explore or play. See Main's `docs/PUBLIC_GROWTH_TOOLS.md` for the SEO checker and feed boundaries.
