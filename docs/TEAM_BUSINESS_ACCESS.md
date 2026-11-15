# One login for Team and JKTL Business

Team members use their existing email and password at either `/admin/login`
(their permitted Team workspace) or `/login` (their Business workspace). They
do not complete customer signup again. Team navigation has **Open JKTL Business**;
the Business account menu has **Team workspace** when current Team access exists.

On a successful native Team sign-in, or after accepting a new invitation, the
existing Team identity is linked to a normal Business user and its own private
workspace. This creates the same starter business profile, owner membership and
infrastructure record as ordinary signup. It grants no paid plan, customer
organization access or additional Team permission.

The existing bcrypt hash is transferred inside one PostgreSQL statement; no
plaintext password is saved, returned or emailed. The Team row becomes explicitly
Business-linked with a non-password marker, so `users` is the single credential
authority. Existing password-reset/change flows revoke Business sessions and the
new password works for Team too. Old native Team sessions are invalidated during
conversion. Shared Team sign-ins keep a seven-day server/cookie lifetime;
ordinary Business sign-ins retain thirty days. Switching replaces the old native
Team cookie rather than allowing a previous Team identity to override the new
Business identity. Opening Business reuses a valid shared session rather than
extending its lifetime on every workspace switch. Team identifiers, role
assignments, content authorship and bank-details
ownership remain unchanged.

If the email already belongs to a separate Business account, the system never
claims it by email matching or replaces its password. The member first authenticates
the Team identity, then confirms the existing Business password at `/admin/business`.
After connecting, that existing Business password is the shared credential. Existing
Business-linked Team identities keep their current user, workspace and password.

New invitation acceptance starts the shared session and opens a permitted Team
landing page. Existing native members are connected lazily at their next successful
login or workspace switch; no bulk production identity migration is run. A user
who has not yet accepted an invitation still needs to accept it and choose the
initial password once. An older unconnected native Team account that has lost its
initial password still uses the Owner recovery process; once linked, Business
password recovery applies.

The Business switch POST is authenticated and rate limited. Its fixed destination
`/account/continue` verifies the server session and initializes the browser's
Business store using the current authorized server snapshot. It never infers
authorization from local storage, reads another tenant's cache, or drains another
workspace's pending offline changes. Switching is blocked when this browser has
unsynced work for another workspace, so it can be recovered before changing accounts.

Business login opens Business by default; explicit template, service, invitation
and game-return intents retain their existing handling. Role-specific Team login
destinations use the shared permission-based landing helper. Business-hosted games
can use the same Business session for saved progress. Public guest play stays public.

Revoking/disabling a Team role immediately removes Team capabilities through the
existing live `linkedBusinessStaff` check. As with previously Business-linked Team
members, their independent personal Business workspace remains a normal Business
account; revocation does not delete or transfer their own sites or invoices.

This does not federate accounts with the separate JKTL Fantasy application's
independent authentication system. No shared-domain cookie, cross-service password
copy, automatic Fantasy admin access or unverified email-based account merge is
introduced.

No new environment variables or schema migration are required. The implementation
uses existing identity, membership, session, profile and audit tables. Changes are
local and remain undeployed; no production accounts, charges or emails were created
while developing this change.

Validation uses isolated PGlite queries and mocked sessions/providers. Tests cover
all Team roles, idempotent provisioning, tenant separation, existing-email conflicts,
two-identity linking, disabled/revoked roles, atomic audit rollback, password reset,
main login, browser-state adoption and cross-workspace outbox protection.

Completed verification: 46 relevant account, invitation, Growth, game-security,
Team-payment and knowledge-base tests passed, together with TypeScript,
targeted ESLint and the production Turbopack build. Browser fixtures using the
actual connection and handoff components passed at 390px and 1440px, including
existing-password confirmation, show/hide controls, session adoption and blocked
cross-workspace offline work. Actions/accounts are mocked in these browser
checks; the server-side tests use isolated PostgreSQL-compatible queries.
Anonymous requests against the local built app return HTTP 307 from
`/account/continue` to `/login`, and from `/admin/business` to `/admin/login`.
Neither new page is publicly cached or indexable. Live account verification is
pending the requested deployment and an authorized signed-in check.
