# Multiple websites per Business account

**Business → Your websites** now lists the original published/template site, additional template/blank sites, and mapped Custom projects. Site cards keep their addresses, copy/open actions and Upgrade links visible. The Business sidebar/mobile bar and editor also show a prominent gold Upgrade action.

Choose **Create website**, select an industry template, blank custom website or landing page, enter a name and choose an available JKTL subdomain. The availability picker offers available alternatives. Creating the draft reserves the address through a unique database claim; a check alone does not reserve it. Open the editor, save and publish. Successful publication returns to the website list.

## Compatibility

The original site stays on `business_profiles`; additional sites use `business_websites`. No existing content, URLs, subscriptions or orders are moved. Existing Custom projects remain managed through their own portal; a blank template does not import a custom source repository. Original-site custom-domain settings keep their existing behavior. Additional sites get independent JKTL subdomains; custom-domain remapping for additional sites is not introduced by this release.

Content/revisions and session draft keys are separate per additional site. An additional-site save never updates the primary website's client store or profile. Upgrade links carry the selected site into Plans so the editor return link stays scoped. Billing remains attached to the existing organization/account plan, using the existing checkout; no extra charge or separate per-site pricing is created automatically.

## Addresses, permissions and reporting

Additive migration 073 creates additional-site storage and `website_subdomains`, backfills original address claims and installs database triggers to prevent cross-table duplicate addresses. Claim failures roll back the site/address write. Reserved names and format checks still apply. Suggestions reveal availability, never another customer's identity.

All mutations require a current Business session and active owner/manager membership. Every added-site read/write is scoped to its organization. Public routing serves only published sites and clears the primary site's custom-domain canonical from added sites. Existing service/booking data continues to belong to the business organization.

Metrics record the added-site identity; site-card Metrics links filter to that website even when two sites use the same template. Combined metrics stay available. The account lifecycle view recognizes added drafts/publications so setup reminders do not incorrectly treat the account as having no website. Existing frozen investor reports remain unchanged.

## Validation

`node tests/multiple-websites.test.mjs` uses isolated PostgreSQL to check content separation, unique address claims/rollback, version conflicts, roles, organization boundaries, public draft exclusion, canonical scope, migration replay and per-site metrics. Existing metric/template/partner/report tests cover shared workflows. `node tests/multiple-websites.browser.cjs` uses mocked server actions to verify mobile/dark layouts, visible Upgrade and website links, suggestions, creation and publication returning to the list. It never creates a live site or makes a payment.
