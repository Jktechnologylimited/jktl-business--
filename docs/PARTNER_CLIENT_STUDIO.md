# Partner client studio

Partners sign in at `/partners/login`. The approved-partner and owner-grant checks remain in place.

## Navigation

- **Overview** shows the partner's own client drafts, owner-approval queue, currently visible published sites and open support tickets, with links to continue work.
- **Clients & websites** (`/partners/workspace`) creates a private client draft and opens the website studio. A `?new=1` link opens the creation form; successful creation selects the new client.
- **Services & payments** (`/partners/billing`) separates quote status from the billing party and leads to the existing Business quote approval/payment workflow. Verified paid invoices do not get another Pay action.
- **Referrals & earnings**, **Support**, client permissions, commercial terms, resources and the knowledge base remain available.

The desktop shell uses a sidebar; mobile has an explicit open/close navigation menu. Theme controls and JKTL branding are retained. Dashboard pages are private and noindex.

## Client workflow

1. Create the client's draft using the business name and owner contact details. This does not create a new credential or charge either party.
2. Choose a template through visual, searchable cards. Previews open in a separate tab. Save the client's content and check desktop/mobile preview.
3. In **Owner & access**, create and privately share the existing invitation link. The owner signs in or creates their Business account, selects the business and grants permissions. Partners never need the owner's password.
4. Refresh access. Editing and publishing are separate permissions. Publishing uses the existing customer website engine and deploys the content to the client's JKTL site. A published site can be opened from the studio or Overview.
5. In **Services & payments**, use current authorized domain checkout or request email/other services. The billing page explains who approves/pays a quote. Partner-billed quotes use the linked Business billing identity; client-billed quotes require the client owner. Existing verification and fulfillment safeguards are retained.
6. Complete the handover checklist. Checklist completion does not activate a product, verify a payment or grant access.

Changing clients asks before discarding dirty website content. Checklist/access refreshes preserve unsaved edits. A failed or version-conflicting save leaves the draft visible. Upgrades do not replace an existing template.

## Security and limits

Portfolio SQL is scoped to the authenticated partner. Published-site details are only returned when an active owner grant permits website access. Revoked access cannot expose live website details. Every mutation continues to check current partner status, product settings, owner permissions and revision/payment evidence on the server.

No domain purchase, publication, new client invitation or live payment is performed by the tests. Payment functionality is surfaced through existing checkout; the redesign does not create a partner wallet or charge a customer automatically. Paused AI receptionist setup is excluded from the new-client service choices.

Tests: `tests/partner-dashboard.test.mjs`, existing partner-workspace/client/native-product tests. Run `node tests/partner-dashboard.browser.cjs` after building for fixture-only browser checks. They use mocked actions without a live account; production requires an approved Partner session.
