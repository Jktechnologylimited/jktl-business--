# Solace Beauty & Spa

Archive 4 contains thirteen design-reference screenshots, not source code or
embedded instructions. `spa-solace` is an additional original peach/coral spa
starter with eight services, featured rituals, a care-values band, four sample
team profiles, three package cards, an appointment request form, testimonials,
a photo strip and four readable care articles. Public preview:
`/templates/spa-solace`.

Main and Business share the registry, renderer and local Unsplash imagery.
Existing template IDs, published sites, authentication and payment behavior
remain intact. Package buttons preselect the package in the existing appointment
request form; they do not charge money or confirm a reservation. Names, prices,
team and testimonials are editable examples. The reference's unsupported
business statistics were replaced with editable care values.

Care articles reuse the existing question/answer content fields, shown as
“Care notes & articles” for this design. Each question is the article title and
each answer is its paragraph-based body. The existing SEO editor lists each
article. Unique slugs are derived from the titles; renaming a title changes its
address. Existing page-path validation accepts `notes/<slug>`; only configured
spa note paths are rendered. This adds no separate blog database or CMS.

New spa drafts preserve their design during save/reload. Article metadata uses
the title/body unless customized. All preview/selection and visible sign-in
controls are retained. Preview forms do not send actual customer requests.

Verification includes complete document/rendering regressions, article editing
and duplicate-slug validation, service/package/article HTTP responses, desktop
and phone layouts, package preselection, sign-in links, public previews, production
builds and focused lint. No live email, notification or customer enquiry is sent.
No database migration, provider integration or new dependency is required.
