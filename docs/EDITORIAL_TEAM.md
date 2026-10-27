# JKTL Editorial Team

Business owns the existing `jktl_publications` table, one editor, one shared editorial media library, Team identities, and the existing branded Resend sender. Main reads only published content through Business's public HTTP APIs. No second CMS, authentication database, email provider, deployment trigger, or incident/status system is introduced.

## Getting started

1. In **Team**, invite a Writer or Editor. Invitations are hashed, expire after seven days, and let the recipient choose their own password through the existing Team authentication system. No password is emailed. An Owner can copy the private recovery link if email delivery is unavailable. An existing Team email is never overwritten by an invitation.
2. The teammate accepts, then signs in at `/admin/login`. Writer and Editor sign-ins open **Editorial** at `/admin/content`.
3. In **My Profile**, set the public name, author URL, biography and optional avatar. Profiles are public only when the author has published content. Email addresses, account IDs, permissions and review records never appear in the public profile API.
4. Choose **Create Content** and one destination: Columns, Blog, Releases or Updates. URLs and destinations stay fixed after the first save, preserving existing links and preventing accidental cross-publication.
5. Complete title, summary, body and slug. Valid drafts autosave after three seconds; explicit Save and an unsaved-change guard remain available. The existing Markdown editor has formatting buttons and a safe formatted preview. Raw HTML is not rendered. Draft text has no public preview URL.
6. Use the shared Media Library for cover and inline images. Uploads reuse Vercel Blob, check file size/type/signature and publication rights, and accept PNG/JPEG/WebP up to 512 KB. Uploaded images are public assets; the UI states this explicitly. Draft article text stays private. Approved HTTPS image URLs also work when Blob is not configured.
7. Submit a draft. The Owner assigns an Editor by opening the submission, choosing **In review** and selecting the teammate. Editors can edit only their own or assigned content. Writers can edit only their own drafts, returned revisions and rejected drafts.
8. Editors approve Blog and Columns, or return work with mandatory review feedback. Official Releases and flagged/security/billing/operations announcements require Owner approval. Removing an existing official-content restriction also requires an Owner.
9. Publish the approved revision, or choose a future schedule. An Editor needs the separate **publish releases** / **publish sensitive updates** permission for these destinations. An Owner configures those permissions under the member in Team. Approval does not deploy software.
10. Editing approved content requires saving it as a draft and submitting again. Publication compares content fields against the approved revision. Unpublish removes the article from public feeds, article pages and sitemap data on the next request.

## Permissions and lifecycle

`DRAFT → SUBMITTED → IN_REVIEW → APPROVED → PUBLISHED` also supports `REVISION_REQUESTED`, `REJECTED`, `SCHEDULED`, and `UNPUBLISHED`. A submitted article may be approved directly by an authorized reviewer without an extra administrative step; submission is still mandatory. Each save creates a versioned snapshot with the actor and review comment atomically. Conflicting revisions cannot overwrite each other. Revision history and on-demand full historical previews use the same ownership/assignment checks.

Writers receive only `manage_content`. Editors additionally receive editorial review while retaining their existing feature/review capabilities. Neither role receives customer accounts, money, team management or software deployment access. Optional official-publishing grants apply only to Editors and do not remove the Owner approval requirement. Disabling a Team account invalidates its ordinary sessions through the existing controls; storage rechecks the current active account on every article mutation.

## Public destinations

- `/columns` and `/columns/[slug]`: original writing, categories, series and chapter navigation.
- `/blog` and `/blog/[slug]`: practical and educational articles.
- `/releases` and `/releases/[slug]`: official product notes, optional version and associated features.
- `/updates` and `/updates/[slug]`: company news and updates. A link points to the existing JKTL Status service for live service health.
- `/authors/[slug]`: public profile and published work across destinations.

Existing release records keep their kind and slug. Old `/updates/[release-slug]` links redirect to `/releases/[slug]` when no Update occupies that slug. Main includes the new destinations in Resources/footer, article metadata, author links and sitemap. Search, category filters, related articles, safe Markdown, WhatsApp/LinkedIn sharing, and reading time reuse the shared frontend. Public requests use `no-store`, so publishing/unpublishing needs no Main deployment or shared in-memory cache. Lists currently include the latest 200 public records per destination; pagination can be added when volumes require it.

## Delivery and scheduling

Status changes atomically queue recipient/event/revision-specific notices. The existing branded email service sends notifications for submission, assignment/review, revisions, approval, publication and scheduling failure. Disabled/revoked recipients are suppressed. Delivery leases, idempotency keys and bounded retries avoid duplicate sends. Article mutations start a delivery pass with Next `after`; provider failures do not discard saved work.

The existing `/api/cron/domains` daily job performs scheduling and retries at 08:00 UTC / **09:00 WAT**. Scheduled times are a lower bound: with the current daily cron, publication happens on the next run after the chosen time. The editor displays this limitation. An Owner can run due publications and queued deliveries sooner from Overview. For precise timing, increase the frequency of this existing authenticated job on a hosting plan that permits it; do not publish from a browser timer. The worker rechecks the current publisher, approver, permissions, due time and revision. Revoked authority returns the item to Approved and alerts the Owner rather than publishing it.

## Deployment and verification

Migration **055_editorial_team.sql** is additive and included in the existing prebuild migration batch. Earlier replayed Team-role constraints also admit Writer, so redeploying after Writer accounts exist remains safe. Existing published content and legacy releases are retained. Both full `db:migrate` and deployment prebuild include the schema changes.

Required live bindings are the existing `DATABASE_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CRON_SECRET`, and `BLOB_READ_WRITE_TOKEN` for uploads. Main uses `JKTL_PUBLICATIONS_ORIGIN`, defaulting to `https://business.jktl.com.ng`. Never paste credentials into chat. Without live bindings, local PostgreSQL-compatible tests and browser fixtures verify implementation but cannot prove deployed mail, Blob or cron delivery.

Main's shared people panels use fixed Unsplash image URLs, contextual copy, meaningful alt text, lazy loading, source credit, reduced-motion support and a local fallback. They illustrate the audience, not fabricated customer endorsements. This workspace's network proxy blocks Unsplash; local browser tests cover the failure fallback. Production photo delivery still needs a deployment check.
