# Growth & Gaming Lead

## Role and access

Display name: **Growth & Gaming Lead**. Existing role naming convention uses
`growth_gaming_lead`; audit assignment identifies `GROWTH_GAMING_LEAD`, category
`STAFF`. Existing `owner` is the platform's highest authority, corresponding to
SUPER_ADMIN in the brief. No duplicate superadmin role or authentication system
is introduced.

An Owner opens **Admin → Staff management**, searches an exact existing Business
email, verifies the person, then assigns the role. The existing `admin_users`
record becomes a linked staff profile, with a unique `business_user_id` foreign
key. Its password field is a non-authenticating sentinel, not a copied customer
hash or another credential. Existing admin accounts remain independent. Email
matching alone never links or grants staff access; assignment targets a user ID.

Staff can sign in at `/admin/login` using their normal Business email/password,
or sign into `/login` normally (without a selected product/template intent) and
land at `/admin/growth`. Authentication uses the existing Business password and
session. Every request reloads the current staff profile, suspension/revocation
and permissions. Password resets remain the existing Business reset process.
Revoking staff access preserves their ordinary Business account and audit history.

There is no existing Business staff-invitation service. A person without an account
uses the normal `/signup` flow, then the Owner assigns their account. No passwords
are emailed, no new invitation token system is invented, and an email address
entered into staff search does not create an account automatically.

## Permissions

The workspace has a fixed `growth_workspace` entry capability. Owners may enable
or revoke each supported group independently:

| Capability | Supported access |
| --- | --- |
| `growth_marketing` | Create/edit own unpublished marketing, social-copy and landing-copy editorial drafts; generate JKTL UTM campaign URLs |
| `growth_publish_approved` | Publish own exact Owner-approved revision, also requiring its content-category capability |
| `growth_leads` | Create manually assigned leads, read/update own assigned contacts and record outreach notes |
| `growth_applications` | Review applicant information, record recommendations and queue messages; no final account approval |
| `growth_resources` | Read approved branding assets and submit resources hidden pending Owner approval |
| `growth_games` | Test approved games, view aggregate Tycoon cloud saves and prepare game announcements |
| `growth_community` | Read consented published feedback and prepare community announcements |
| `growth_analytics` | Aggregate programme referrals, verified website-paying organizations and new-ledger commission summaries; assigned-lead conversions |

Broader legacy capabilities cannot be enabled through these overrides. Growth
staff cannot access banking/payout details, approve payouts, change commission
rates or agreements, adjust financial records, issue refunds, change product
prices, manage staff/security/deployment settings, run collection/scraping jobs,
export unrestricted contacts, view private client workspaces or operate game
scores/results/rewards. Support is their own existing Business help inbox, not
access to unrelated private conversations or the full staff support queue.

## Existing modules reused

- Existing Admin OperationsFrame, JKTL logo, navy/gold/cream theme and typography.
- Existing `prospects` contact model, with a nullable staff assignment. Existing
  outreach automation/consent/suppression controls remain separate. The workspace
  records activities but does not pretend to send an email. Suppressed leads
  cannot be updated through Growth actions. Paid conversion counts come from
  verified website payments, never a user-selected lead status.
- Existing `jktl_publications` and public Blog/Releases API. Draft authors can
  edit only their own unpublished current revision. Editing clears approval.
  Owner approval is for the exact revision; stale/unapproved publish requests
  fail. Existing Editors/Owners retain their publication authority.
- Existing Affiliate/Partner applications, resources and transactional notice
  outbox. Recommendations appear in the final admin application review screen.
  Sending a review message does not approve an account. New resources remain
  hidden until an Owner approves through Distribution → Resources.
- Existing Tycoon saves for aggregate account/recent-save counts. No player
  documents, private game accounts or leaderboards are exposed.
- Existing `/business/help` assistant, case history and human handoff for the
  staff member's own product, campaign or game assistance requests.
- Existing `distribution_audit` for assignments, permissions, suspensions,
  revocations, denials, content approval/publication, applicant reviews and work.

## Explicit integration gaps

The separate Fantasy repository has its own authenticated admin system; there is
no authenticated cross-application staff content/analytics API to reuse. Assigning
this Business role does not confer Fantasy administrator privileges. A future
integration needs narrowly scoped authenticated endpoints and independently
reviewed permissions. GitHub repository development access is assigned outside
Business; no tokens or deployment secrets are exposed here.

Social publishing connectors, a standalone campaign execution/attribution engine,
remote game settings/categories, guest-session analytics and direct Main homepage
landing-page editing are not connected. Social/landing categories are copy briefs
stored as existing editorial drafts. Published announcements appear in the selected
Blog/Releases destination, not a fictional social post or game configuration.
UTM links are real URLs; no campaign clicks, CAC or paying attribution is invented.

## Database/deployment

Migration 047 extends `admin_users`, `prospects` and `jktl_publications` and adds
only `growth_application_reviews`, since recommendations must remain separate
from final application decisions. Existing account/role/auth/billing tables are
reused. Migrations 033 and 037 retain the new role in their replayed role checks,
preventing future prebuild failures after a staff assignment. Prebuild includes047.

No new environment variables. Deployment needs its existing `DATABASE_URL`;
transactional messages need the existing email/cron configuration. No production
roles, accounts, emails or game privileges are created by tests or migrations.

## Validation

`tests/growth-staff.test.mjs` uses the actual migrations and isolated PGlite.
It tests Owner assignment, ordinary-user rejection, existing Business password
sign-in, no duplicate password, restricted capabilities/override rejection,
permission-aware navigation, scoped leads, real-payment-only conversion policy,
exact-revision approval, clearing approval on edits, safe applicant recommendations,
hidden resource submissions, current-session permission changes and revocation.
The role remains present when earlier prebuild migrations replay. Full regression,
TypeScript, lint, production build and responsive UI checks are separate checks.
