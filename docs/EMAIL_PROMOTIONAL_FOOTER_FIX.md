# Shared promotional footer fix

28 October 2026 — Africa/Lagos.

## Follow-up: received Gmail invitation still omitted the footer

The received screenshot proves that the invitation/date changes deployed, but the footer did not. The first fix was insufficient: final-payload tests supplied both marketing consent and a postal address, unlike a new invitation recipient using default branding. The shared sender **and** selector still required both prerequisites. The screenshot has no postal address, which alone prevented the section.

The shared policy now includes the small service-discovery footer in requested role/programme invitations and new-account welcomes by default, without requiring a separate marketing subscription or company postal-address setup. It does not change or infer `marketing_opt_in`. Explicit recipient suppression, legacy opt-outs, caller suppression, global OFF, disabled/deleted items, category restrictions and security exclusions still apply. Standalone marketing and other email categories retain their existing consent/postal requirements. This is limited to service discovery in invitations/welcomes, not permission to send unsolicited campaigns.

The complete provider-payload regression now starts with **empty branding settings and no recipient preference row**, then verifies the default footer in HTML/text, welcome and programme invitations, and no footer in resets. Additional tests cover opt-outs, legacy suppression, explicit suppression, global OFF and refusal of marketing without consent. Optional footer lookup failures now produce a generic server-side diagnostic (no recipient, token or database-error details), rather than silently hiding an operational failure.

Follow-up validation: production build (including TypeScript) and focused ESLint passed. All **20 focused email tests passed**, including the provider-boundary regression and existing invitation, authorization, Reply-To, compose, opt-out and persistence coverage.

Preview guidance now describes these category differences. No schema change or manual reseeding is required for this follow-up. Production database/provider access is still unavailable here; inbox verification must use a newly sent invitation after the follow-up deployment. Previously delivered emails do not change.

## Original root cause

Role invitations and programme invitation/reminder sends used the `security` category. Both the shared selection service and final layout intentionally strip all promotional content from security messages. Therefore invitations could never contain a footer, even with promotions enabled and an eligible recipient.

The older seed catalogue also had narrow email-category arrays and no JKTL Business link. The old manager had no delete control. An empty catalogue had no initialized-versus-intentionally-empty marker, and migration 049 could recreate removed seed IDs on replay. These were separate problems from Gmail styling.

The current workspace has no production `DATABASE_URL` or email-provider binding. Production database settings and the received Gmail message could not be inspected directly; the classification problem was verified from the actual send/renderer code path. Existing consent, suppression, sender-address and ownership conditions can independently suppress optional promotions and are retained.

## Exact changes

- Added an `invitation` mail category. Team, editorial, Affiliate, Partner and reminder invitations now use it. Reply-To routing, secure tokens, role acceptance and approval logic are unchanged. Password resets, verification/recovery/security messages remain `security` and cannot gain a footer.
- Added one-time, atomic initialization of the existing `email_promotions` catalogue. Untouched legacy defaults are replaced with the five requested items; custom configuration, an explicit disable or a deliberate empty catalogue are respected. There is no fallback that recreates items after initialization.
- Migration **061_email_promotional_footer.sql** adds `promotions_initialized_at` and `deleted_at` to the existing tables. Delete is confirmed and leaves a tombstone. Migration 049 now checks the initialization marker before inserting historical seed links, so deployment replay cannot resurrect removed items.
- The shared layout renders **Explore More from JKTL**, after the signature and before the existing company footer, in both HTML and plain text. It retains the official logo, navy/gold/cream palette and responsive presentation tables. Links use small text and inline styles. The default limit is three, configurable up to four.
- Footer items can have an optional linked product; a custom administrator-created item no longer disappears merely because it has no product-registry ID. Ownership filtering still removes relevant already-owned products. The verified public domain/email information links do not require an enabled checkout quote to be displayed, and do not change purchase availability or invent prices.
- **Email Branding → Promotional Footer** now contains one ON/OFF setting, one editable list, one Add/Edit form, enable/disable, up/down ordering, confirmed deletion and one complete-email preview. New items start at the top. Unsaved edits and the unsaved global switch can be previewed without changing the database or creating an invitation. Saved changes apply to future eligible emails without redeployment.
- The existing safe self-test send remains available in that section and can only address the authenticated administrator's email. Other branding saves preserve the footer settings. Row revisions protect against stale edits.
- Invitation expiry is formatted with `Africa/Lagos`, for example **Your invitation expires on 30 October 2026 at 9:09 PM (WAT).** HTML and plain text no longer display the role invitation's raw ISO timestamp.

## Verified default links

Public GET requests were made during this task. All destinations returned HTTP 200:

| Item | Stored destination | Verification |
| --- | --- | --- |
| Website Templates | https://jktl.com.ng/templates | Direct 200 |
| Domain Registration | https://jktl.com.ng/domains | Requested `/products/domains` redirects here; final 200 |
| Business Email | https://jktl.com.ng/products/business-email | Direct 200 |
| JKTL Business | https://business.jktl.com.ng | Direct 200 |
| JKTL Partners | https://jktl.com.ng/partners | Direct 200 |

The catalogue entries are editable database defaults, not a hardcoded footer appended to each invitation. No prices, offers or discounts were introduced.

## Eligibility and privacy

Enabling the footer does not create marketing consent. Marketing and other non-invitation/non-welcome sends require the existing optional-marketing eligibility checks: opted-in recipient, no suppression/opt-out, genuine configured company postal details, enabled footer/items and relevant product/category. Invitations and welcome emails use the follow-up service-discovery policy above. Missing or unavailable preference data fails closed for optional promotions; the essential invitation can still be sent without marketing. Security/internal emails and explicitly non-promotional operational compositions remain free of product promotions.

The preview states its assumed eligibility and warns if required company information is missing. An administrator who has never configured footer content does not need to add those five links manually. This does not bypass recipient preferences or invent company postal details.

## Validation

The complete **HTML and text arguments passed to the mocked Resend SDK** were captured for a real invitation helper call, rather than testing only the web preview. Tests verify the heading and clickable URLs, signature/footer ordering, a single shared footer, inline presentation-table structure and existing brand colors, correct WAT expiry, welcome/programme invitation eligibility, and footer exclusion in the reset provider payload.

Database-backed tests verify default initialization, create/edit, disable/enable, reorder, unsaved preview isolation, global OFF, deletion confirmation, deletion persistence across migration replay and even physical deletion after initialization, and administrator authorization. The existing regression suite also covers invitation acceptance, payments, domain services, Business Email, support, roles and schema behavior.

Results: **194 tests passed**, production build passed, TypeScript and focused ESLint passed. The captured synthetic provider payload is available locally at `/tmp/jktl-invitation-footer-provider.html` and `.txt`.

No live email or bulk email was sent. There is no connected Gmail/browser tool or provider credential here, so actual inbox delivery and Gmail rendering remain unverified. After deployment, the restricted **Send saved preview to my email** button can be used from a Gmail-backed administrator account to perform that final check. Migration 061 is included in the existing deployment prebuild and normal migration workflow; production application was not independently verified from this workspace.

## Files

Shared logic: `src/lib/mail/{layout,service,promotions,promotion-defaults,invitation-date,preview}.ts` and `src/lib/email.ts`. Existing invitation actions/reminders only change category. Existing admin actions and branding/promotion components supply the simple manager. Schema changes are in migrations 049 (replay guard) and 061 (additive fields). End-to-end provider-payload and persistence tests are in `tests/email-footer.test.mjs`, with updated existing email regression coverage.
