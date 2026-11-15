# JKTL AI in the Business workspace

**Ask AI** reuses the existing support assistant, conversations, platform help
guides and notification/human-handoff workflow. It is available from the floating
Business support control. It is a platform guide, separate from a customer's
website chatbot and the disabled receptionist/call product.

The panel is lazy-loaded when opened. Opening/closing it makes no support or AI
request. It keeps the current conversation while closed, makes requests only
for explicit messages, handoff or Check replies, and has no polling/retry loop.
Changing account or mode remounts the dock and clears its conversation state.
The existing review invitation remains available when the panel is closed.

If the chat chunk itself cannot load during an outage/offline session, the
failure stays within the dock. It offers an explicit retry and existing guide,
support and WhatsApp links rather than breaking the whole Business screen.

Live messages use the existing authenticated support actions. The backend checks
the current requester, active membership and organization on each read/write.
Questions retrieve at most three public platform guides across websites,
domains, email, plans, billing, invoices, operations, accounts, games, Partners,
Affiliates and Custom projects. Private Team runbooks are not sent to customers.
The model receives a bounded recent history and a 650-token output limit using
the existing private DeepSeek configuration, temperature zero and no tools.

Generated replies cannot claim to have charged, registered, refunded, changed
or provisioned an account. Unknown or sensitive requests use the existing human
escalation. Reply safety and approved-destination checks reject invented links;
the interface renders actual screen/article links from the retrieved guides in
blue, rather than turning arbitrary model/user text into clickable links.

The reply is labelled JKTL AI only when an AI reply was accepted. Missing or
failed provider responses use labelled knowledge-base guidance. Demo mode uses
the same public guides locally without creating cases or making AI calls.
If the live service fails, the panel offers local guide answers, Help & support
and the existing WhatsApp contact. It does not claim an uncertain request was
delivered and does not retry automatically. A person can take over in the same
case; updates are fetched explicitly or through the full existing support page.

No database migration, new AI provider, extra cron or paid service is added.
Existing support rate limits and authentication remain authoritative. This chat
does not authorize account assistance, billing, publishing or ownership changes.

A hosting suspension can prevent both the initial app load and live requests.
Previously loaded/cached guides may help, but a chat feature or redeployment
cannot lift a Vercel usage limit. Renewal/notification cron jobs also depend on
working hosting; existing renewal catch-up selects the current reminder window
after service resumes, rather than sending every missed reminder.

The owner authorized the Business release on 15 November 2026. Deployment status,
hosting availability and live provider replies must be verified independently;
release authorization does not lift a hosting quota.
Tests use isolated/mock support and AI transports; no live AI, email, registrar
purchase, invoice charge or customer message is sent for verification.
