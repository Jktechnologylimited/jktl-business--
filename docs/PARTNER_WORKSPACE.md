# Partner operations

The existing product registry, template catalog, website renderer, client
organizations and native fulfillment queues are reused. No parallel website or
billing system is created. Product availability and actions are Owner controlled;
new products default to unavailable until reviewed.

- `/partners`: real client/draft/support counts.
- `/partners/workspace`: multiple named client drafts, existing searchable template
  catalog, shared website fields/renderer, desktop/mobile preview and revision-safe
  saving. Client-owner acceptance is required before publishing. The owner grants
  viewing, requests, content editing and publishing independently; revocation
  blocks subsequent operations. Partners never impersonate owners.
- Authorized client services show real domain/email/website statuses. Requests
  enter existing domain tasks or email requests and create a related support
  conversation. Runtime product validation, current grants and product action
  rules apply to each mutation. Requests cannot transfer domains, reveal passwords,
  change ownership, make payments or bypass licensing/provisioning controls.
- Automatic onboarding evidence (claim/design/publish) is distinguished from
  partner-confirmed profile, review, training and handover checklist items.
- `/partners/support`: categorized, prioritized tickets, conversation/reopening,
  private PNG/JPEG/WebP/PDF attachments (512 KB each, 5 MB/ticket), explicit optional
  notification registration and PWA installation guidance. Closed tickets are
  read-only. Protected attachments require an active authorized session and are
  returned as downloads with no-store/nosniff/sandbox headers.
- `/admin/partner-support`: queue search and filters, response-target overdue
  visibility, eligible staff assignment/reassignment, private internal notes and
  sensitive Owner escalation. Support cannot read sensitive tickets. Response
  targets are operational goals, not public 24/7 guarantees.
- Durable ticket notices exclude private message bodies and internal notes.
  Existing email/Web Push settings are reused. Subscriptions bind to current
  sessions, invalid endpoints are pruned, transient delivery is retried. Missing
  configuration leaves notices queued; installation alone does not grant push
  permission. Staff opt in through the existing admin support control.
- `/partners/commercial`, `/partners/resources`: accepted agreements, verified
  financial ledger, bank verification, payout requests, CSV statements and approved
  promotional resources. Owner approval and actual fulfillment/payment evidence
  remain mandatory. See DISTRIBUTION_IMPLEMENTATION.md for financial controls.

Migrations 040–046 are additive. No production messages, purchases, bank transfers
or provider registrations are made by automated tests. Live deployment still needs
working database/provider configuration, scheduled cron execution and operational
verification using approved identities. Existing legacy obligations remain intact;
no migration activates the proposed global 15%/20% policies.
