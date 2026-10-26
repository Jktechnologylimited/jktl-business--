# Partner service workspace

Migration 040 extends the existing shared feature registry with partner eligibility,
action permissions and service mode. Defaults are seeded once; replaying the migration
must not re-enable a product an Owner disabled. New products default to unavailable
until reviewed under Admin → Distribution → Partner products.

## Available workflow

- `/partners`: actual workspace, relationship, draft and open-ticket counts.
- `/partners/workspace`: create multiple named client drafts, select a client,
  browse/search/filter the existing template library, reuse the existing website
  fields and renderer, preview mobile/desktop and save a draft before acceptance.
- Invite owners with a hashed one-use, seven-day claim link. Acceptance binds the
  workspace to the owner's selected existing organization; it never grants the
  partner ownership or impersonates the client. Signup can create that client org.
- Owners grant website editing and publishing separately under
  `/business/distribution`. No permission is preselected. Publishing before client
  acceptance is rejected. Website operations use the customer save engine and
  renderer, with grant, product and current partner agreement checks locked into
  the update. Revocation blocks subsequent writes and stale revisions fail closed.
- Domain, email and other assisted products route through authorized service
  requests at `/partners/clients` and the existing JKTL fulfillment operation.
  They do not create unapproved purchases or pretend to register/provision anything.
- `/partners/support`: create categorized, prioritized client tickets, read the
  conversation and reply/reopen resolved tickets. Closed tickets remain read-only.
- `/admin/partner-support`: existing Support and Owner staff identities handle
  the queue. Non-sensitive tickets are claimable and subsequent changes require
  assignment. Sensitive tickets require Owner access. Notes stay outside the
  partner conversation. Messages and status events retain their history.
- `/partners/earnings`: existing commission, bank verification and payout reporting.

The active signed agreement still determines commissions. Proposed 15%/20% policies
remain draft. There is no new fee for free websites, no automatic client billing,
no new provider admin access and no unrestricted mailbox access.

## Current limits and production work still required

This delivery expands operational access but is not the entire master brief.
Domain/email purchase and provisioning remain the existing customer-approved,
assisted workflows; partner checkout, negotiated reseller billing and direct DNS
configuration are not enabled. Partners can provide authorized image URLs using
the existing content controls; partner-specific file upload is not added.

Support notifications, attachment handling, configurable response targets,
advanced assignment/filtering and additional onboarding checklist tasks remain
outstanding. The payment-connected policy ledger and cohort activation from the
previous brief also remain outstanding. Do not advertise those as live features.

No new environment variables. Prebuild includes migration 040 using the repaired
SQL runner. Existing DATABASE_URL is required in deployment. Current cloud checks
use isolated PostgreSQL-compatible databases; no real domains, mailbox provisioning,
payments, customer invitations or staff notifications are performed by tests.

Before launch, validate the complete flow using approved test identities and a
nonproduction tenant, including owner claim, product disablement, switching clients,
publication cache invalidation and revocation. Production delivery and browser
accessibility/responsiveness are not established by unit tests or a build alone.
