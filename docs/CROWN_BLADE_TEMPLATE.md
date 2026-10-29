# Crown & Blade barbershop template

Archive 3 contains eight barbershop design-reference screenshots, not source
code or embedded instructions. `barber-monochrome` is an additional original
starter with a monochrome palette, Gothic headings, split barbering photography,
services, a horizontal work gallery, team portraits and client stories.
Public preview: `/templates/barber-monochrome`.

It uses the existing shared registry, editor, website renderer, document parser
and booking/contact actions in Main and Business. Home, about, services, three
individual service pages, gallery, booking and contact are included. New drafts
retain `beauty.design = "barber"` through parsing; existing customer drafts and
other templates are preserved. Sign-in icons and public preview/selection flows
remain shared. Carousel buttons respect reduced-motion preferences and the work
track supports native horizontal scrolling.

Content, names, prices and testimonials are clearly editable demonstrations.
The reference's discount announcement was not reproduced. No real appointment,
review, promotion or client identity is claimed. Preview forms do not send real
requests. Photos are local Unsplash images. The local UnifrakturCook typeface is
distributed with its SIL Open Font License in `public/template-fonts`.

Verification: document round trips and all-template rendering/sign-in regression
checks; public routes and service links; desktop/phone layouts; gallery previous/
next controls; booking navigation; production builds and focused lint. No live
customer enquiries, emails or notification sends. No migration, new dependency,
credential, authentication or customer-website changes are required.

The browser regression checks exposed an intermittent sticky-toolbar/hover edge
case in the existing gallery. Hover motion now zooms only the thumbnail rather
than moving action buttons, and Info has a toolbar scroll offset. Controls stay
in place; the gallery still respects reduced-motion preferences.
