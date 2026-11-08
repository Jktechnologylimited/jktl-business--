# JKTL platform knowledge base

Public entry: `https://business.jktl.com.ng/help` (no sign-in to read). Team entry: **Team → Knowledge base**, `/admin/knowledge` (authenticated Team access).

The initial release contains 55 public guides and 15 private Team runbooks. Topics cover setup, templates and publishing, domains and renewals, Business Email, checkout and subscriptions, everyday business tools, account/PWA/security, support, Partners, Affiliates, Custom projects, chatbot, games and public resources. Team runbooks cover permissions/invitations, support handling, customer care, service fulfillment, branded email, lifecycle/renewal operations, partner percentages, distribution finance, Custom integration/billing, Editorial, investor reports and Growth/Gaming.

## Reading and sharing

Use the search form and topic filter, open an article, and share its stable URL. Each article includes steps, troubleshooting, escalation, an action-area link and related guides. Search works server-side with JavaScript disabled. Search/filter pages canonicalize to `/help` and use noindex/follow; public article pages have their own canonical and meaningful server-rendered H1. Unknown and private article slugs are not public routes.

Business Help links to the full library. Partners and Affiliates have topic-specific Knowledge base links. Main Help Centre and its footer link to the complete public library. The existing inline Business help remains available.

## Sources and safety

`src/lib/support/knowledge.ts` remains the public help source, augmented by `src/lib/knowledge/additions.ts`. The support assistant and public help API use this same public source. `src/lib/knowledge/catalog.ts` supplies categories, search and related-guide selection. Team content lives separately in server-only `src/lib/knowledge/team.ts`; public catalog/API/chatbot imports never include that module.

All Team roles can read the runbooks through `view_knowledge`. Their operational capabilities remain unchanged. Both private page handlers guard access, and private metadata is noindex/nofollow. Reading a guide cannot change accounts, approve agreements, activate paused products, fulfill services or verify payments.

The knowledge base documents the current limitations, including paused receptionist calls/bookings, policy-rate proposals requiring accepted/activated agreements, unknown registrar outcomes requiring reconciliation, limited Custom CMS scope, and unaudited report coverage. Do not replace these with promises of unvalidated behavior.

## Updating

Edit public and private sources separately, verify actual route names and implemented actions, review the static reviewed date when making substantive changes, and run the knowledge/support/permission tests and production build. Do not place live credentials, personal case records or client financial data in an article. Existing Main-site inline guides remain their own curated material; the complete library link points to this Business source.

Tests: `node tests/knowledge-base.test.mjs`, `node tests/support-reviews.test.mjs`, `node tests/admin-permissions.test.mjs`. Tests cover real route targets, complete article content, search/topic behavior, server-rendered H1/steps, related links, public/private isolation and role checks. No production database changes are required.

Programme recovery uses separate Partners and Affiliates URLs, email wording and sign-in destinations. The backing token lookup is scoped to the programme. Legacy emailed reset URLs are routed to the stored token's actual programme; a token cannot be consumed through the other programme's action. Password fields include keyboard-accessible show/hide controls. No recovery test sends a real email or changes a live account.
