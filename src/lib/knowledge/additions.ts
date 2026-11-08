import type { HelpGuide } from "@/lib/support/knowledge";
export const PLATFORM_GUIDES: HelpGuide[] = [
  {
    id: "platform-map",
    title: "Find your way around the JKTL platform",
    tags: [
      "overview",
      "navigation",
      "platform",
      "main",
      "business",
      "team",
      "partner",
      "affiliate",
    ],
    route: "/business/more",
    summary:
      "The public website, Business workspace, partner programmes and Team workspace have different purposes and permissions.",
    steps: [
      "Use jktl.com.ng to explore products, pricing, case studies, published resources and public template previews. Browsing a template does not require an account.",
      "Use business.jktl.com.ng for your own business account. Sign in with the email you registered, complete setup, and confirm the active business before editing or paying.",
      "Open More for Website, Templates, Domains, Business Email, Plans, renewals, AI Chatbot and operational tools. Available navigation can vary with business type and permission.",
      "Partners use /partners/login for client-service and referral work. Affiliates use /affiliates/login for their promotion programme. A Business account alone does not automatically approve programme membership.",
      "JKTL Team members use /admin/login. An invitation assigns access; knowing a page URL does not grant permission.",
      "Use this knowledge base for instructions, and Business Help & support for account-specific requests. An article never confirms that an account action or payment has been completed.",
    ],
    problems: [
      "Wrong workspace: check your email and active business before making changes.",
      "A restricted screen is not a reason to create duplicate accounts or ask for another person’s password.",
    ],
    escalate:
      "Ask support to identify the correct workspace or invitation route. Ownership and permission changes require an authorized Team member.",
  },
  {
    id: "account-to-published",
    title: "A checklist from new account to published website",
    tags: ["checklist", "onboarding", "launch", "free", "publish"],
    route: "/business/website",
    summary:
      "Complete the first website in clear stages, then decide whether a custom domain or paid plan is useful.",
    steps: [
      "Create or sign in to your Business account and complete your business details. Use an email you control.",
      "Browse templates by industry and website or landing-page type. View before selecting; inspect desktop and mobile layouts.",
      "Select a template or blank starting point, keeping the same account throughout sign-in and onboarding.",
      "Replace sample branding, text, services, contact information, social links and images. Remove sample reviews and unsupported claims.",
      "Save, inspect both preview sizes, and publish when ready. Verify the public address in a separate tab.",
      "Test navigation, buttons, contact links and spelling. A successful preview does not replace a public-site check.",
      "Return to the same business to connect a custom domain or choose a plan when needed. Do not select another template merely to upgrade.",
      "Check renewals and support messages regularly. Keep original content and assets so edits are easier to recover.",
    ],
    problems: [
      "Selected template missing: stop before replacing an existing site and ask support with the template name.",
      "Published page looks old: verify the last successful save, published address and correct business before retrying.",
    ],
    escalate:
      "Share the screen, template name, website address and exact error with support. Keep passwords and payment secrets out of screenshots.",
  },
  {
    id: "partner-sign-in",
    title: "Partner sign-in, invitations and password recovery",
    tags: ["partners", "login", "password", "reset", "invitation", "approval"],
    route: "/partners/login",
    summary:
      "Sign into the Partners workspace using the account associated with your partner application or accepted invitation.",
    steps: [
      "Open business.jktl.com.ng/partners/login. Do not use the Affiliates dashboard for partner work.",
      "If invited, open the latest invitation and follow its account or sign-in instructions using the invited email. A replaced, revoked or expired link cannot grant access.",
      "An invitation can create a programme profile while approval and commercial terms remain separate steps. Check the displayed application status.",
      "Use Reset password on Partner sign-in if you cannot remember the programme password. Partner recovery stays on /partners/forgot-password and /partners/reset-password. After saving, return to /partners/login.",
      "Enter the approved account email and check its inbox and spam folder. Request a new link if the previous one expires.",
      "After resetting, return to Partners sign-in with your new programme password. This reset does not change a separate Business account password.",
    ],
    problems: [
      "Awaiting approval: password changes do not approve an application.",
      "A partner invitation showing the wrong programme or account needs Team review; do not accept using a different person’s email.",
    ],
    escalate:
      "Contact JKTL with your application email and the error text. Never forward the complete invitation/reset token in a public message.",
  },
  {
    id: "partner-client-sites",
    title: "Create and manage websites for partner clients",
    tags: [
      "partners",
      "clients",
      "templates",
      "permission",
      "website",
      "onboarding",
    ],
    route: "/partners/clients",
    summary:
      "Use the partner client workflow and explicitly granted client permissions to help a business create and manage its website.",
    steps: [
      "Sign into an approved Partners account and open Clients or Workspace. Check that the client relationship is listed and authorized.",
      "Use the client invitation or account-creation workflow provided there. Keep the client’s identity and business separate from your own partner profile.",
      "Have the client accept any required invitation or grant access. A referral link alone is not permission to edit private account data.",
      "Open the authorized client workspace, confirm the client name, then choose or edit its template. Use desktop/mobile previews and replace sample content.",
      "Save and publish only the content the client has approved. Verify the live client address after publication.",
      "For domains, email or other purchases, review the quote, billing party and scope. Confirm whether the client or partner is responsible for paying.",
      "Use the existing client workspace for upgrades. Ask for additional permissions if you need chatbot or other management tools; website-editing permission is not universal access.",
    ],
    problems: [
      "Client missing: confirm the relationship invitation was accepted and access was not revoked.",
      "An unavailable action can mean the account lacks the required permission, rather than a broken editor.",
    ],
    escalate:
      "Ask partner support to review the relationship, permission or quote. Ownership, refunds and payment disputes require a higher-authority Team member.",
  },
  {
    id: "partner-commission",
    title: "Understand partner percentages, proposals and earned commission",
    tags: [
      "partners",
      "commission",
      "percentage",
      "earnings",
      "rate",
      "proposal",
      "commercial",
    ],
    route: "/partners/commercial",
    summary:
      "An agreed percentage, an active commercial contract and a verified earned commission are different records.",
    steps: [
      "Open Commercial terms to read your issued agreement, current status, eligible products, duration and payout rules.",
      "A proposed percentage does not activate commissions. A policy agreement must be accepted by you and activated through the authorized Team workflow.",
      "Percentage changes agreed with JKTL are shown in the commission-update history. Policy website changes apply using the qualifying payment date, not the later reconciliation date.",
      "Previously recorded earnings and payouts are not recalculated just because the configured rate changes. Product-specific and reseller terms can differ from the website rate.",
      "Look at the ledger for verified payments and statuses such as pending, under review, available or paid. A customer signing up is not automatically a qualifying paid commission.",
      "Refunds, chargebacks, self-referrals, service costs, caps and eligibility periods can affect the amount. Use your accepted agreement rather than assuming every purchase qualifies.",
      "Complete payout details and use the payout-request workflow when eligible. A request is not confirmation of a completed payout.",
    ],
    problems: [
      "No earnings after a referral: check the customer actually made an eligible verified purchase and that the agreement was active at the relevant time.",
      "A rate proposal can be visible before any active agreement exists.",
    ],
    escalate:
      "Ask partner support about a specific purchase reference or agreement. Do not post bank details, card data or complete payment payloads in a public chat.",
  },
  {
    id: "affiliate-getting-started",
    title: "Start promoting as a JKTL Affiliate",
    tags: [
      "affiliates",
      "referral",
      "promotion",
      "earning",
      "resources",
      "links",
    ],
    route: "/affiliates",
    summary:
      "Use your approved affiliate profile, referral link and current marketing resources to introduce JKTL accurately.",
    steps: [
      "Apply or accept your invitation using the intended account. Sign in through /affiliates/login and confirm approval and programme status.",
      "Read the current terms and Commercial section before promising a rate, bonus, eligible product or payout date.",
      "Copy your own referral link from your workspace. Open it in a separate browser to check the destination; never substitute another participant’s code.",
      "Use Marketing Materials and the approved product information. Explain the benefit of a free website without claiming paid services are free.",
      "Disclose your referral relationship where required. Share with an appropriate audience; do not spam or impersonate customers.",
      "Track referrals and earnings in the workspace. Visits, registrations, verified purchases and available commissions are different stages.",
      "Keep your payout details current and request payment only through the platform’s eligible workflow.",
    ],
    problems: [
      "Wrong referral code or missing attribution: keep the original link and purchase reference for support.",
      "Do not promise earnings from unverified payments, self-referrals or purchases outside the accepted terms.",
    ],
    escalate:
      "Use affiliate support for attribution, application or payout questions. Ask for review rather than creating duplicate profiles.",
  },
  {
    id: "custom-client-workspace",
    title: "Use JKTL Business with an existing custom-built website",
    tags: [
      "custom",
      "client",
      "cms",
      "integration",
      "existing",
      "source",
      "project",
    ],
    route: "/business/custom",
    summary:
      "A Custom project links an existing client and website to authorized Business tools; it does not automatically turn every source-code feature into an editable field.",
    steps: [
      "Sign into your existing Business account using the email linked to the client organization. You do not need a new customer identity solely because your site was custom built.",
      "Open Custom and choose the correct project. If no project is shown, ask the Team to verify the organization, client account and project mapping.",
      "Use the project’s edit or portal action for the content fields its integration exposes. Check the live preview and save result.",
      "A source repository alone is not a live CMS connection. The website deployment must use the project’s configured integration and authorized content schema.",
      "Custom layouts, code-only features and unavailable fields need the project’s agreed development workflow. Ask support before assuming a text editor controls every feature.",
      "Use the project billing area for invoices and service renewals where configured. Review scope, currency, amount and due date before paying.",
      "Open support from the correct project so the Team can identify the site and service involved.",
    ],
    problems: [
      "No editable content: the project may not yet have the required CMS fields or deployed integration.",
      "Do not paste project API keys, database URLs or repository credentials into support chat.",
    ],
    escalate:
      "Ask the Custom project Team to review mapping, deployment or content scope. Ownership, secrets, billing changes and source-code access need authorized handling.",
  },
  {
    id: "custom-client-billing",
    title: "Pay a Custom project invoice and check its status",
    tags: [
      "custom",
      "invoice",
      "billing",
      "hosting",
      "domain",
      "subscription",
      "payment",
    ],
    route: "/business/custom",
    summary:
      "Custom service invoices are separate from invoices you create for your own customers.",
    steps: [
      "Open Custom in Business and select your project. Find the service or invoice associated with your website work.",
      "Check the issuer, description, due date, currency and amount. Hosting, maintenance, email and domain services can have different billing periods.",
      "Use the invoice’s Pay action and complete the existing secure checkout. Do not pay a support agent’s personal account based on a chat request.",
      "Return to the invoice and wait for server-side payment verification. A checkout window closing does not prove payment failed or succeeded.",
      "If you were charged but the invoice still appears unpaid, retain the reference and contact support before starting another payment.",
      "Check the final receipt/invoice status and the service renewal date. Payment and provisioning can be separate stages.",
      "For a dispute or incorrect scope, request review with the invoice reference. Do not alter an invoice you did not issue.",
    ],
    problems: [
      "No invoice shown can mean no service invoice has been created or mapped; it is not proof that you owe zero.",
      "Tenant sales invoices are for your own customers and do not settle a JKTL service invoice.",
    ],
    escalate:
      "Ask the project billing Team to review incorrect amounts, duplicate charges, refunds or an invoice linked to the wrong business.",
  },
  {
    id: "renewal-checklist",
    title: "Check all renewals and avoid paying twice",
    tags: [
      "renewal",
      "hosting",
      "email",
      "domain",
      "subscription",
      "reminder",
      "expiry",
    ],
    route: "/business/renewals",
    summary:
      "Use recorded due dates and verified invoices to plan renewals across your services.",
    steps: [
      "Open Renewals and review each domain, email, hosting or Custom service shown for the active business. Check the actual service name and due date.",
      "Confirm the service is still needed and that the billing contact can receive reminders. Review invoices through the signed-in workspace rather than an unexpected payment link.",
      "Follow the relevant renewal or invoice action. A domain renewal, a website plan and business email are separate services unless your agreement explicitly bundles them.",
      "Keep the payment reference and wait for verification. Check the new expiry or service date after fulfillment; a receipt alone may not prove the registrar completed a renewal.",
      "If a due date or service is missing, ask the Team to confirm it. The renewal screen can only remind you about dates recorded in the system.",
      "Do not rely on a reminder as a guarantee that a service will stay active. Review upcoming dates yourself and allow time for unresolved payment or provider issues.",
    ],
    problems: [
      "Reminder after payment: check the invoice and service dates before paying again; synchronization may need review.",
      "Expired domains or disabled services may require provider-specific recovery rather than an ordinary renewal.",
    ],
    escalate:
      "Contact support promptly for an overdue service, missing payment or unexpected expiry. Refunds and exceptional recovery need authorized review.",
  },
  {
    id: "payment-recovery",
    title: "Charged but still unpaid: what to do next",
    tags: [
      "payment",
      "charged",
      "pending",
      "duplicate",
      "verification",
      "failed",
      "receipt",
    ],
    route: "/business/help",
    summary:
      "Keep the transaction reference and request verification before repeating a charged checkout.",
    steps: [
      "Identify the exact purchase: website plan, domain, email or Custom invoice. Confirm the correct business account.",
      "Check the payment status inside that purchase, not only your bank alert or checkout screen.",
      "If checkout is still processing, return using the supported flow and wait for the displayed verification result. Do not repeatedly create new orders.",
      "If money left your account but the order remains unpaid, save the reference, amount, time and error message. Redact balances, card data and unrelated transactions from any screenshot.",
      "Open Help & support and request payment review with those details. A support conversation cannot itself certify that a payment succeeded.",
      "Only retry when the original transaction has been reconciled or the authorized Team confirms a safe next step.",
    ],
    problems: [
      "Different payment and order references can indicate separate attempts; give the Team both references.",
      "Never share an OTP, full card number, PIN, CVV or payment secret.",
    ],
    escalate:
      "Duplicate charges, suspected fraud, refunds and chargebacks must be escalated to the authorized billing Team.",
  },
  {
    id: "domain-registration-status",
    title: "Understand domain search, payment and registration status",
    tags: [
      "domain",
      "availability",
      "registered",
      "pending",
      "dns",
      "provisioning",
    ],
    route: "/business/domains",
    summary:
      "Availability checking, payment verification, registrar registration and DNS connection are separate steps.",
    steps: [
      "Search for the complete domain and check spelling and extension. An availability result is a time-sensitive check, not a reservation.",
      "Review the displayed selling price, renewal information and required registrant details before checkout. Use information the registrant has authorized you to provide.",
      "Complete payment through JKTL and wait for server verification. Registration can still be processing after payment.",
      "Check the domain’s status in the dashboard. Do not assume a paid order means the domain is registered until confirmation is recorded.",
      "Use the domain-management actions available for your account to review nameservers and connection details. DNS changes can take time to become visible.",
      "If a registration attempt times out or remains uncertain, request a status check before creating another paid order. A registrar operation can succeed even if its response is delayed.",
      "Transfers, renewals and EPP/lock changes have separate requirements. Follow the available interface and ask support when an operation is unavailable.",
    ],
    problems: [
      "A domain becoming unavailable between search and purchase needs a Team review of the paid order.",
      "Website content being published does not by itself connect an unverified custom domain.",
    ],
    escalate:
      "Ask domain support about unresolved paid orders, ownership authorization or expiry. Do not share registrar credentials or EPP codes in public messages.",
  },
  {
    id: "email-replies-delivery",
    title: "Understand JKTL emails, Reply-To and delivery",
    tags: [
      "email",
      "notifications",
      "reply",
      "sender",
      "spam",
      "invitation",
      "mail",
    ],
    route: "/business/email-preferences",
    summary:
      "Platform notices, replies to JKTL and the business email mailboxes you buy are different things.",
    steps: [
      "JKTL Business notifications can be sent from the verified mail.jktl.com.ng sender domain. Read the actual sender and destination carefully.",
      "Reply-To controls the mailbox your email application uses when you reply. It does not create a new inbox or change the email address on your account.",
      "For an invitation or reset link, check that it relates to your account and use the most recent valid link. Do not forward the token to another person.",
      "Check spam and search your inbox for the subject if a message is missing. Verify the account email spelling with support.",
      "Manage optional marketing preferences in Email preferences. Essential account and service notices can have different purposes from promotional mail.",
      "Business Email purchased for your own domain is managed in the Email product. Changing notification preferences does not provision or renew those mailboxes.",
    ],
    problems: [
      "Provider submission is not proof of inbox delivery or that a person opened the email.",
      "If an email looks suspicious, navigate to the signed-in platform directly rather than entering a password from the message.",
    ],
    escalate:
      "Contact support for incorrect recipients, missing essential notices or suspected phishing. Send a redacted screenshot, not a full reset or invitation URL.",
  },
  {
    id: "games-and-accounts",
    title: "Play JKTL games and understand saved progress",
    tags: ["games", "runner", "tycoon", "word", "fantasy", "points", "login"],
    route: "https://jktl.com.ng/games",
    summary:
      "Use the Games navigation to find available experiences and check each game’s own sign-in and save behavior.",
    steps: [
      "Open Games and choose the experience you want to play. Guest play and saved progress depend on the game.",
      "Read the controls or first-run instructions before starting. On mobile, keep the play area visible and use the game’s navigation to change games.",
      "Game points, demo trading prices and practice cash are entertainment data, not money in a JKTL customer wallet.",
      "If you want to save, use the game’s supported account flow. Do not assume guest progress transfers automatically to another browser or a separate Fantasy service.",
      "Use a free-website link in a game only if you want to create or manage a Business website. Playing a game does not publish a website or purchase a service.",
      "For loading problems, check connection, browser support and device performance. Avoid clearing local data before asking about unsaved progress.",
    ],
    problems: [
      "A game without a save confirmation may not have stored your latest progress.",
      "Separate deployments can require their own supported session flow; do not enter credentials into an unofficial game copy.",
    ],
    escalate:
      "Report the game name, device, browser and exact behavior to support. Do not promise that unsaved guest progress can always be recovered.",
  },
  {
    id: "main-site-resources",
    title: "Use product pages, case studies, blog and updates",
    tags: [
      "main",
      "products",
      "solutions",
      "resources",
      "blog",
      "case",
      "release",
      "seo",
    ],
    route: "https://jktl.com.ng",
    summary:
      "Use the public JKTL website to compare products and see real examples before choosing a service.",
    steps: [
      "Browse Product and Solutions to find the relevant product page rather than relying on an old advertisement or retired demo URL.",
      "Use Templates to preview designs freely, then select one when ready to sign into Business. A preview does not create an account or paid order.",
      "Read Pricing and the specific checkout or agreement for current charges, periods and included services. Avoid assuming a case study includes the same package.",
      "Use case studies to understand work delivered for named clients; results and features depend on each project.",
      "Read published Blog and Releases & updates for guidance and product changes. A planned feature is not necessarily available in your workspace.",
      "If you find a broken link or inaccurate claim, report the page URL and relevant wording.",
    ],
    problems: [
      "Old search results can point to retired demo sites or legacy routes. Use current navigation to find a relevant product.",
      "A public article does not grant Team, partner or client permissions.",
    ],
    escalate:
      "Ask support to identify the current product or route, or send an editorial correction with the page URL.",
  },
];
