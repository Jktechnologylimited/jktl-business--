# Business account outreach in the existing Emails workspace

Open `https://business.jktl.com.ng/admin/emails` with a team account authorized for communications.

## Start a conversation

Choose **Account support check-in** to load an editable account-help message addressed to all active business owners. Reply-To is prefilled from Email Branding; the requested default `info@jktl.com.ng` is configured in the Business database. Review the account list, edit the subject/body and click **Preview and count recipients**. Confirm the exact recipients and the operational-purpose acknowledgement, then **Queue individual emails**.

The feature does not send messages automatically on page load, audience review, template selection or preview. Each recipient receives their own message; other customer addresses are not placed in CC. Existing queue pacing, recipient rechecks, provider history, suppression handling and retry rules remain in use. Provider acceptance does not prove inbox delivery.

Replies are addressed to `info@jktl.com.ng` in the recipient's email app. Read and answer them in the existing mailbox. This change does not create an inbox, receiving service or incoming-thread synchronization in JKTL Business.

## Audiences

- **All business owners:** unique emails of active organization owners, excluding ordinary staff memberships.
- **New business accounts:** owners whose user accounts were created within the last 30 days.
- **Existing business accounts:** owners whose user accounts were created more than 30 days ago.
- **Published websites using a free subdomain:** owners of published sites with a nonempty free subdomain and no configured custom domain. Unpublished websites and sites with a configured domain are excluded, including domains awaiting verification.
- **Selected business owners:** choose existing owners using the account picker or the email field. Addresses outside the chosen account scope are not added.

Multiple memberships never produce duplicate email recipients. New/existing groups use account creation time, not a guessed last-login date. Counts are refreshed from actual records. A recipient's membership, consent or website/domain state changing after preview invalidates or suppresses that recipient rather than silently adding new people to a saved campaign.

## Starter copy and message type

**Welcome & setup help** targets new accounts and provides account-use guidance. **Account support check-in** offers help using existing accounts. These are operational starters, and sending still requires the operator to confirm that the main message is necessary account information. Editing one into an upgrade advertisement requires selecting Promotional instead.

**Custom domain upgrade** selects free-subdomain owners and Promotional mode. It links to the existing domain dashboard, offers help choosing or connecting a domain and invents no price or availability guarantee. The body remains editable and uses the existing Markdown renderer/shared branded layout. The shared signature is not duplicated in the starter text.

Promotional messages continue to require saved opt-in, no suppression and the genuine company postal address in Email Branding. This implementation does not enroll users in promotions or modify their preferences. Users can manage their own preferences at `/business/email-preferences`.

## Observed setup on 5 November 2026

Read-only validation found 21 unique active owner emails: 12 new and 9 existing accounts; 2 owners matched the published free-subdomain audience. All 21 were eligible for necessary account-help messages. No promotional opt-ins were recorded, and no company postal address was configured, so the current domain-upgrade promotional audience has zero eligible recipients. These counts are live data, not fixed UI copy.

The default Reply-To was set to the user's requested existing contact mailbox, `info@jktl.com.ng`, with an audit event. Existing sender/provider authentication was preserved. This change does not claim that receiving-mailbox delivery was independently tested. No real outreach email was sent during implementation.

## Implementation and verification

Reuses `/admin/emails`, `affiliate_campaigns`, `distribution_program_notices`, Email Branding, the existing email provider and Email History. No new database tables, campaign system or worker were introduced.

Changed: `src/lib/mail/business-outreach.ts` (labels/starter text), `src/lib/mail/compose.tsx` (owner/cohort/domain selection), `src/lib/actions/email-compose-actions.ts` (read-only audience review), and `src/components/mail/compose-email.tsx` (picker, starter buttons, count/eligibility review and reply guidance).

Tests cover actual PostgreSQL-compatible queries, ownership and age filters, domain/publication state, duplicate memberships, selected-account scope, role restrictions, opt-ins/suppression, Reply-To propagation and recipient changes between preview and queueing. Existing email management/branding regression tests remain passing. Isolated desktop/mobile browser tests use mock actions to verify form behavior, confirmation gates and zero-eligible promotional feedback; they never send real mail. Production build, TypeScript and targeted ESLint checks are required before release.
