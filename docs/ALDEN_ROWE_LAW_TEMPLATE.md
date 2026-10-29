# Alden & Rowe law-firm template

The supplied law firm.zip contains eleven design-reference screenshots, not
source code or embedded instructions. `law-firm-counsel` is an additional original
editorial design: pale olive navigation, a large office hero, four coloured
practice cards, sample attorney profiles, an approach statement and insights.
Public preview: `/templates/law-firm-counsel`. The older `law-firm-editorial`
edition remains unchanged; the new template has its own unique ID.

The existing WebsiteDocument, editor and storage hold all content. `design=legal`
selects the renderer; new drafts retain it through parsing. The firm photo, attorney
names/roles/photos, practice copy, preparation points, articles and demonstration
label are editable. Profile contact details, social links, service areas and genuine
reviews continue to use existing fields. Choosing this template copies the owner's
business name into the initial branded headline; the headline remains editable.

Home, about, practice index/detail pages, attorneys, insight index/articles and
contact have real routes. Existing page-path/metadata helpers retain their legacy
names for compatibility and now cover this design. Published sites expose correct
canonical URLs, a LegalService schema and eligible sitemap paths; prospect sites
remain excluded from indexing. No new database tables or provider are introduced.

The enquiry form reuses the current server-side public request action, tenant
lookup, validation, bot checks, rate limiting, customer storage and owner
notification path. Legal requests are contact enquiries only; that endpoint rejects
legal appointment requests and does not take payment. Existing configured Business
booking/product widgets remain available on the contact page. General enquiries
request brief information, discourage confidential material and do not create an
engagement. Preview forms do not send requests.

All names and profiles are demonstration material and the imagery is local
Unsplash stock photography. No founding year, free consultation, credentials,
case outcomes or invented testimonials are claimed. The reference's attributed
quotation is replaced with original firm-approach copy. Demo labels stay on until
the owner supplies verified information and explicitly turns them off.

Verification: full catalog/document/rendering regressions; tenant-scoped legal
enquiry tests with mocked storage/email; appointment rejection; publication metadata
and schema; public route responses; desktop/phone sign-in and menu layout; preview
form behavior; production builds and focused lint. No live email or enquiry sends.
No migration, dependency, credential, auth or existing-customer draft change.
