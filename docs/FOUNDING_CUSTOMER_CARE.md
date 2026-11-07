# Founding customer care

Hands-on setup and priority follow-up for the explicitly reviewed 21 existing
business accounts. The live cohort was selected once, with a guard requiring
exactly 21 eligible account profiles and an empty cohort. New signups are not
silently added. Membership is persisted in the Business database; it does not
change plans, entitlements, pricing, renewals or customer website content.

Team → All businesses links to **Founding customer setup & priority follow-up**.
The existing Support inbox also links to `/admin/support/care`, guarded by
`manage_support`. The board shows public-profile readiness flags, a responsible
teammate, follow-up date, stage, checklist and internal notes. It does not expose
account passwords, private sales records or invite access to customer websites.
Updates use revision checks, credential redaction, active-team assignment checks
and an audit log. Support/owner roles can use it; other roles require the existing
capability. Billing and security-sensitive requests still escalate normally.

Checklist: customer brief; branding/content; agreed template/custom design;
mobile/desktop/navigation/contact form testing; domain/email/renewal needs review;
owner training; customer signoff; verified live launch/handover. All these must
be checked before Complete. Honest feedback/public case-study permission is a
separate optional step, never a condition of support. A free JKTL subdomain is a
valid launch; no paid product is required by this checklist. Profile flags reflect
Business records only, not an independent audit of external custom sites.

Founding-account cases are flagged and prioritized after urgent escalations.
Resolved cases stay last. Existing case visibility, assignment, customer editing
consent and sensitive-case restrictions remain intact. Inbox filters can narrow
to founding accounts or one selected business without granting additional access.
No tickets, notification emails, publish actions or automated outreach are created
simply by enrolling accounts or opening the board. Follow-up dates are operational
tasks, not a promised 24/7 support service or guaranteed response SLA.

Emails → Compose Email includes **Founding customer — hands-on setup help**, an
operational draft for selected business owners. It asks for business goals, logo,
public contact details, content and design references, explains free-subdomain
launch, and points owners to the consent-based assistance flow. The existing John
sender/signature and configured Reply-To are reused. The draft does not send
itself, promise complimentary paid products, or request passwords/payment details.

Initial read-only review: 21 profiles, 2 published sites, 1 selected template,
no recorded profile logos or complete phone/email contact pairs, and no open
support cases. These are setup signals, not claims that custom client websites
lack content. All initial checklist items remain unverified. Customer input and
team review are still needed; no profiles were fabricated or sites published.

Tests use PostgreSQL semantics for optimistic updates, assignment, auditing,
priority ordering and authorization. They verify handover cannot be marked
complete prematurely and that feedback is optional. Existing support and email
regressions, browser layout checks and the production build cover integration.
