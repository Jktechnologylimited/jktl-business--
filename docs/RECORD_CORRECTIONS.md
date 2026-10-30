# Correcting administrative records

Use **Edit details** on the record, make the correction, then **Save changes**.

| Area | Corrections |
| --- | --- |
| Affiliates | Display name, email and profile note, for pending and existing profiles |
| Partners | Display name, email and profile note |
| Custom Projects → Clients | Business name, owner name, owner email and owner phone |
| Custom Projects → Projects | Existing project form edits name, URLs, description, status, deployment references, linked services and notes |
| Team | Display name, email and role; existing role-specific permission controls remain available |

Programme managers may correct profile names/notes. Sign-in email corrections and team changes require an owner. Custom client details require the existing Custom management capability.

Email changes require explicit confirmation. If the record is linked to a Business identity, its Business login and linked programme/team emails are corrected together. Account IDs, passwords, organization ownership, referral codes, bank details, earnings, accepted agreements and invoices are preserved. A new email cannot belong to a different account; editing never silently merges identities or transfers ownership.

Affected sign-in sessions are revoked after email/role changes. Old unaccepted invitations and password-reset links are revoked after email changes. For a pending account, send a fresh invitation to the corrected address using the existing Emails/Custom Projects flow. No email is sent automatically by the correction control.

Team role changes clear previous permission overrides and sign out the affected identity. An owner cannot change their own role, and the transaction protects the last active owner. Disabling, restoring and removing access remain separate existing controls.

Changes check the loaded profile snapshot to prevent overwriting another operator's edits. The atomic database function records before/after details and actor identity in the existing audit logs. Custom client changes are also recorded in the Custom audit.

Migration 065 installs the correction function without altering existing account data. Tests use isolated PostgreSQL, not live customer corrections.
