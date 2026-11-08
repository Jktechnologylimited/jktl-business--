# Website templates are multi-page

JKTL's catalogue rule: only templates classified as landing pages by `templatePageKind` use one-page anchor navigation. Every other template, including blank website starters, must have real public pages. `websitePagePaths` is the shared route registry used by preview routes, published routes, metadata and the site's XML sitemap.

General industry websites have Home, About, Services and Contact, plus their applicable Gallery, Service Areas, Reviews, Approach and FAQ pages. Existing beauty and legal layouts retain their specialist pages. The dressmaker has Home, Atelier, Collection, individual collection looks, Our Process, Gallery, FAQs and Contact. The same saved document supplies editable content for these pages; no new customer database records or schema are introduced.

The public preview remains free, with template selection/signup and the login icon preserving the selected template. Editor navigation uses the same real hrefs but intercepts normal clicks inside the preview so unsaved content remains in memory. Modified/new-tab clicks retain ordinary URL behaviour. Published sites use their own subdomain/custom-domain origin, real routes and per-page canonical metadata. Unknown pages and landing-page subpaths return 404. Main preview canvases remain noindex. Preview subpages are cached on first access rather than all being eagerly expanded during builds. Booking query selection hydrates in the client, preserving preselection while keeping the server-rendered preview cacheable.

Real booking/services/products appear on Services for general websites and Contact for the atelier. Existing legal and salon booking flows remain. Service selection carries its identifier to the destination page. No fake checkout, appointment, review, contact address or client record is created. Older generic website contact/gallery/etc. fragment links are forwarded to their real page where one exists. Landing-page anchors retain their existing behaviour.

Checks must cover all catalogue entries for page classification, page titles/descriptions, exactly one rendered H1, direct route responses, invalid paths, editor draft preservation, mobile navigation, published-origin canonical URLs and sitemap membership. Keep Main and Business catalogue/renderers in sync when importing future template ZIP references.

Deployment remains on hold until JKTL explicitly says deploy. Local builds must skip Business prebuild migration hooks; do not publish customer sites or alter customer databases during preview tests.
