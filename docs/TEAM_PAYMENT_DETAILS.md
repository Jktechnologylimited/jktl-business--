# Private payment details for JKTL Team

This feature prepares bank details for manual team compensation. It does not send money, charge an account, create a salary obligation or create a customer wallet.

## Team member flow

Open **My payment details** at `/admin/team/payment-details` while signed in to a JKTL Team account.

1. Choose a Nigerian bank and enter a 10-digit account number.
2. Verify the account through the existing server-side Paystack account resolver.
3. Check the returned account-holder name and confirm the account can receive team payments.
4. Submit for Owner approval. Saving re-verifies the account server-side; a browser-supplied name or verification flag cannot create an approved account.
5. Any replacement returns the account to pending approval. A stale version cannot overwrite newer details.

This information is optional for platform login/access. It is the approved destination used when preparing a team payment. Members can view or remove only their own saved details. Removal erases the encrypted account payload and bank metadata while retaining an audit entry. Removing the underlying Team account also deletes its bank-details record.

## Owner flow

Open **Team payment details** at `/admin/team/payments`, also linked from the existing Team management page.

- Filter pending, approved, rejected, removed or all submissions. Lists contain up to 25 records per page.
- Compare the team member with the bank-verified name and masked account number.
- Approve the current verified revision or reject it with a short explanation visible to the member.
- For an approved, active member's current revision, explicitly reveal the number when preparing a manual payment. The reveal is audited and the interface hides the number after 30 seconds, on blur or when the tab is hidden.
- A bank-account approval is not approval of a particular transfer. The Owner still approves and makes any payment separately.

All recognised Team roles have self-service access. Only **Owner** currently has `manage_team_payments`, so Analysts (even with company-finance viewing), Executive Associates, Support, Affiliate Managers and Editors cannot list/review another member's details. No implicit finance role or broad permission override is introduced. Team compensation is independent of affiliate commissions, merchant receiving accounts, custom-project invoices and customer settlements.

## Configuration before enabling

Reuse the existing private `PAYSTACK_SECRET_KEY`. The public bank catalogue alone is cached for one hour; account lookup, private details, approval and reveal responses are never put in a shared cache.

Add **`TEAM_PAYMENT_DETAILS_ENCRYPTION_KEY`** through secure deployment settings: exactly 32 random bytes encoded as standard base64. It must never use a `NEXT_PUBLIC_` prefix. Back it up securely. There is no fallback to a session, Paystack or domain-contact secret. Losing or replacing the key without re-encrypting existing records prevents those records being opened; do not rotate it blindly. Restoring the correct backed-up key is required before normal access resumes.

If verification credentials/key are absent, the page explains that verification is unavailable. No account is treated as verified or approved because configuration is missing.

## Storage and authorization

Migration `079_team_payment_details.sql` creates `team_payment_details` and `team_payment_details_audit` alongside existing Team identities. It is repeatable and included in the standard deployment migration list. It creates no bank records, salaries, invoices, transfers, payment recipients or commissions.

Account number and resolved name are encrypted with AES-256-GCM, independent random IVs and associated data bound to the Team account ID. Public bank name/code, last four digits, status, verification timestamp and review metadata are stored separately. Copying one member's ciphertext to another member fails authentication. Client summaries never include ciphertext or a full account number.

Server actions derive the actor from the existing live Team session. Service and SQL checks recheck active/revoked identity, role, target account and revision. Owner read queries also check current ownership at the data read. JSON fields cannot choose a different self-service identity or claim Owner authority. Full-number access requires an explicit reason and fresh authorization; owner payment preparation requires an approved revision. Disabled/revoked members are excluded and cannot use saved credentials to edit their details.

Submit/review/removal mutations and their audit insert occur in the same SQL statement. Audit insert failure rolls back the mutation. Audit rows contain actor/member IDs, event, revision, time and a fixed reveal reason; raw bank numbers and names are not logged. Audit IDs survive Team-account deletion without retaining its encrypted bank payload. Database errors and raw provider responses are not exposed through action errors. Rate limits bound bank lookup, verification, edits, reviews and reveals.

## Verification and rollout

The implementation is local and **must not be deployed until requested**. Production data and configuration have not been changed; no migration, bank lookup, charge, transfer or email was executed against production for this work.

Automated tests use actual PostgreSQL-compatible queries in PGlite and mocked bank-provider responses. They cover encryption binding/tampering, self/Owner separation, forged identities/overrides, fresh verification, approval invalidation, stale writes/reveals, disabled users, rejected/provider-failed changes, erasure, atomic audit rollback and pagination.

Browser checks use the actual React components with explicitly mocked actions at 390px and 1440px: verify/confirm/save, verification invalidation after edits, masked summaries, explicit reveal/auto-hide/blur, removal, Owner approval/rejection, stale-review handling and missing-configuration fallback. These checks do not establish real provider availability or access to a live bank account.

Completed checks: 24 payment-details/permission tests and 21 related Team regression tests passed, as did TypeScript, targeted ESLint and the production Turbopack build. Both new routes are dynamically rendered. Anonymous requests to both built routes return HTTP 307 to `/admin/login` with private/no-store cache headers. The private encryption-key variable is absent from generated client JavaScript. Desktop/mobile fixture checks passed without browser errors or horizontal overflow.

Before a future authorised launch: install the private encryption key, run the normal additive deployment migration, then validate the complete signed-in member/Owner flow with an approved test account and the existing provider settings. No money transfer is needed to verify account resolution.

A pre-existing Turbopack Google-font URL resolver error blocked final production verification for Space Grotesk. Its unchanged official font is bundled locally, with licence, following the existing Fraunces approach. Existing font identifiers, weights and design are preserved.

Repeatable checks:

```sh
node --test --test-isolation=none tests/team-payment-details.test.mjs tests/admin-permissions.test.mjs
npx tsc --noEmit
npm --ignore-scripts run build
```

Skipping lifecycle scripts in the local build deliberately prevents the standard prebuild from running migrations against a configured production database.
