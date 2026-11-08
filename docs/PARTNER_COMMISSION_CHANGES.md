# Edit a partner percentage

Open **Team → Partners**, find an approved partner, and choose **Edit commission percentage**. Enter a percentage (for example `22.5`, not basis points), record the agreed change, confirm agreement with the partner and save. New applications also use percentages on the approval form.

The editor supports the existing percentage programme and active policy referral contracts. A policy partner without any issued contract can save a proposed percentage; it is labelled as a proposal and cannot activate earnings. The percentage must be included in Commercial terms accepted by the partner and activated by the Team. Policy edits apply to the website-subscription percentage (maximum 50%, matching existing policy validation). Legacy percentages allow 0–100%. Issued offers, inactive policy contracts, reseller pricing, fixed rewards and other product-specific rules use **Commercial terms**; this editor does not silently replace them.

Changes are stored as immutable, dated amendments with the previous/new rate, Team actor and reason. Partner commercial pages show the history. The displayed profile rate updates atomically with the audit record. Refresh/stale-value checks prevent silent overwrites.

Website policy reconciliation resolves the amendment using the verified payment's paid-at time, so a delayed reconciliation of an old payment retains its earlier rate. Existing contracts, customer paid-month allocations, earned ledger rows and payouts are not rewritten. Saving a percentage does not approve an account, activate a contract or issue a payout. No emails are sent by this edit action.

Additive migration `072_partner_commission_changes.sql` creates the amendment storage and immutability trigger. Automated tests use isolated PGlite fixtures; browser fixtures mock saves and never update real partner percentages.
