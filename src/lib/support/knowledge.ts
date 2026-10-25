export type HelpGuide = {
  id: string;
  title: string;
  tags: string[];
  route: string;
  summary: string;
  steps: string[];
  problems: string[];
  escalate: string;
};
export const HELP_GUIDES: HelpGuide[] = [
  {
    id: "first-website",
    title: "Get your first free website online",
    tags: ["free", "website", "start", "signup", "onboarding", "account"],
    route: "/business/website",
    summary:
      "Create an account, choose an industry template and publish a website on your JKTL address. A domain purchase is a separate decision, not a requirement for your first free site.",
    steps: [
      "Use the live JKTL Business signup page, not the salon demo. Enter your own name, a working email you control and a unique password. Read the account terms before submitting. Do not send your password to a member of support.",
      "Complete the business setup with the correct business name and industry. These details determine the navigation you see; a salon and a retail business can have different labels for similar tools.",
      "Open Website from More or open /business/website directly. If no design is selected, browse Templates. View opens a preview; Edit brings the chosen design into the editing flow. A signup started from a template should keep that selection through onboarding.",
      "Use the desktop and mobile preview icons before choosing. Inspect the navigation, text length, contact section and call-to-action on both sizes. Pick a blank canvas only if you want to build the content yourself.",
      "Replace sample headings, business description, services and contact details. Upload a logo and images you have permission to use. Remove sample testimonials; use genuine customer reviews only.",
      "Review your free JKTL website address in Website settings. Follow the validation message for allowed characters and availability. A business address is a public identifier: avoid personal identification numbers, passwords or anything confidential.",
      "Save the design. Wait for the explicit successful save message. A preview and an unsaved editor do not prove the live website was updated. If the application reports a version conflict, follow the saving-conflicts guide before trying again.",
      "When ready, publish using the website editor. Open the published JKTL address in a separate browser tab and test the navigation, phone/email links and contact details. Ask someone else to check the mobile layout.",
      "Keep a copy of your original text and image files. The live site is a public business presence; never put customer records, private documents or secret keys in a website section.",
    ],
    problems: [
      "Cannot find Website: open More, then Website, or follow the direct workspace link above. Navigation depends on industry and screen size.",
      "Still seeing the salon demo: sign out of the demo and sign into the account you created. Demo edits are not a production business website.",
      "A paid plan appears: a custom domain, email or optional service can require payment. Return to the JKTL-address publishing route; buying a domain is not required to start your first free website.",
    ],
    escalate:
      "Request human support if onboarding repeatedly fails, a selected template is lost, or publishing gives an error after a successful save. Include the screen name and exact error, not your password.",
  },
  {
    id: "templates",
    title: "Choose a template, blank canvas and mobile preview",
    tags: [
      "template",
      "blank",
      "design",
      "mobile",
      "desktop",
      "industry",
      "edit",
    ],
    route: "/business/templates",
    summary:
      "Use a complete website or landing-page design, and retain the same selected design when you later upgrade.",
    steps: [
      "Open Templates in JKTL Business, or start from the public template gallery. Search your industry and check whether you need a full website or a single campaign landing page.",
      "Select View to inspect a design without changing your business account. Use the desktop and mobile icon buttons in the preview toolbar. The mobile preview is a narrower viewport, so verify text wrapping, navigation and button spacing.",
      "Select Edit only when you want to use the design. If asked to sign in, use your existing account. Avoid creating a second business solely because you followed a template link.",
      "For a blank starting point, use the Blank option for the relevant website or landing-page type. A blank canvas intentionally starts without industry content. You will need to add the sections you want to publish.",
      "Open your selected design in the website editor. Confirm the correct business and current design before replacing sample content. Selecting a design is separate from saving your content.",
      "Add Home, About, services or offerings, service areas, contact details and social links where they suit your business. A landing page can use a shorter set of sections focused on one campaign.",
      "Replace placeholders and check link targets. Do not leave sample service prices, fabricated reviews, phone numbers or social usernames in a published design.",
      "Save, then inspect both preview sizes again. Publishing exposes the current approved content; a preview alone is not a live website.",
      "When upgrading, use Plans or Billing in the existing workspace. An upgrade should retain your selected template. Stop if a flow proposes replacing a design you already use and request support with the current template name.",
    ],
    problems: [
      "Wrong design after signing in: confirm the account and business first. Record the intended template name and open the original Edit link; do not overwrite a working site just to experiment.",
      "Images appear stretched: use an image with suitable dimensions and inspect both preview sizes. Avoid putting essential text inside a photograph.",
      "Blank canvas looks empty: this is expected. Add content before assessing the finished website.",
    ],
    escalate:
      "Ask support before changing an existing published template. Support cannot silently replace your chosen design or erase existing content.",
  },
  {
    id: "saving",
    title: "Save, publish and recover from editing conflicts",
    tags: [
      "save",
      "publish",
      "revision",
      "conflict",
      "changed",
      "unsaved",
      "editor",
    ],
    route: "/business/website/template",
    summary:
      "A successful save, a live publication and a preview are different states. Version checks protect work saved in another tab.",
    steps: [
      "Before editing, confirm the business name in the workspace and close duplicate editor tabs. If someone else is editing, agree who will save next.",
      "Make a small change first and save it. Wait for the success or error message and keep the page open while the request finishes.",
      "If the message says the website changed in another session, copy your new text into a local document before reloading. Reload the latest version and compare changes. Reapply only the edits still needed.",
      "Do not repeatedly press Save after a conflict. The saved revision belongs to the server; forcing an old revision risks overwriting another person’s work and is intentionally blocked.",
      "Use only supported image URLs and formats. If an image validation fails, remove the rejected URL, use the upload field or an allowed source, and try the specific edit again.",
      "Review the Publish control separately from Save. Check whether the page is saving as a draft or changing publication. Never assume a draft is public.",
      "After a successful publish, open the exact public address in a private tab. Make sure you are not opening the editor URL, a template preview or a different business’s address.",
      "If stale content remains, reload once and compare the public address with Website settings. Capture the exact address, time and visible discrepancy for support; do not share a session link or credentials.",
      "When requesting assisted editing, grant only the permission needed for this support case. You can revoke it at any time. Your own edits can still cause a revision conflict, so coordinate with the assigned agent.",
    ],
    problems: [
      "Save spinner does not finish: check your internet connection. Keep a copy of your edits, reconnect and reload the latest revision before retrying.",
      "Published site differs from the preview: check the save result and the business address. The two pages may represent different saved versions.",
      "Editor rejects content: read the field-specific validation. Long text, unsupported URLs and missing required content are not fixed by repeated submission.",
    ],
    escalate:
      "Escalate to human support with the exact validation message and expected change. Access, deletion or ownership disputes must go to an administrator.",
  },
  {
    id: "domains",
    title: "Choose, purchase and connect a domain",
    tags: [
      "domain",
      "tld",
      "ng",
      "com.ng",
      "name.ng",
      "availability",
      "register",
      "dns",
    ],
    route: "/business/domains",
    summary:
      "Domain availability must be confirmed before checkout. Registration, hosting connection and DNS propagation are separate steps.",
    steps: [
      "Open Domains in your signed-in Business workspace. Enter the spelling you want carefully and consider .com.ng, .name.ng, .ng, other country-code extensions and global TLDs appropriate for your audience.",
      "Compare registration and renewal prices separately. Some names have special pricing or eligibility requirements. A search result or an enquiry does not reserve a name.",
      "If the status says Checking for availability, wait for an actual confirmation. Do not interpret that message as Available. Checkout must not be unlocked by a guess from the assistant or an unverified screenshot.",
      "Review the confirmed domain, period, contact information, registration amount and renewal amount. Confirm the business owns the registrant information. Support must not register a customer’s domain using the agent’s personal identity.",
      "Complete a purchase yourself in the secure checkout. Support can explain the steps and direct you to the correct workspace but must not request your card number, CVV, bank login or OTP.",
      "Return to the workspace and check the order status. A paid order can still need registration/setup work. A payment receipt is not proof the domain has completed registration.",
      "After registration is confirmed, connect the domain to the intended website. Copy the exact DNS instructions shown for that domain and product. Keep a record of the old values before changing DNS.",
      "Check whether your domain also carries email. Changing nameservers or deleting MX/TXT records can interrupt existing mail. Ask for a reviewed change plan when the same domain hosts more than one service.",
      "Allow for DNS caches to refresh. The timing depends on the registrar, records and TTL; no assistant can promise an exact propagation deadline. Test both the main name and www if both are configured.",
      "Check HTTPS after the domain resolves to the right site. Certificate setup depends on correct DNS and completed hosting connection. Keep the free JKTL address available while troubleshooting.",
    ],
    problems: [
      "Checking never completes: ask support to inspect the domain request; do not pay through a different unverified link.",
      "Domain paid but not live: distinguish payment verification, registration, DNS connection and HTTPS. Report the exact stage shown in Domains.",
      "Website works but email stops: stop making DNS changes and escalate with the record names/types that changed. Never send a mailbox password.",
    ],
    escalate:
      "Transfers, registrant changes, refunds, ownership conflicts, registrar credentials and destructive DNS changes require an administrator or authorized provisioning specialist.",
  },
  {
    id: "renewals",
    title: "Renew domains and avoid expiry surprises",
    tags: ["renew", "renewal", "expiry", "expires", "transfer", "registrar"],
    route: "/business/domains",
    summary:
      "A domain renewal is a separate order. Never assume a website subscription renews a domain or mailbox.",
    steps: [
      "Open Domains and find the exact asset and expiry date. Confirm the domain belongs to the active business account.",
      "Read the renewal quote and period. Compare the renewal price with the original registration price; they may differ.",
      "Start renewal early enough to handle payment verification or eligibility questions. Reminders help but are not a guarantee that a registry will keep an expired name available.",
      "Complete the authorized renewal checkout yourself. Do not provide an agent with banking credentials or an OTP.",
      "After payment, check whether the renewal is paid, processing or actually completed. The expiry date should change only after the provider’s completed period is recorded.",
      "If the order is pending, record the payment reference and contact support before opening another payment attempt. A second debit does not automatically repair an unfinished first order.",
      "For an already expired domain, ask for a current eligibility/price check. Restoration and redemption periods can depend on the extension and registry. Do not rely on a generic grace-period promise.",
      "Keep registrant contact details current through the authorized account-owner process. A transfer or ownership change is not a routine support-agent edit.",
    ],
    problems: [
      "Expiry did not move after payment: ask whether the renewal has been fulfilled, not only whether the charge succeeded.",
      "Transfer requested instead of renewal: stop and confirm the intended operation and current registrar before continuing.",
      "Unknown renewal amount: obtain a current reviewed quote; do not estimate from an old promotional price.",
    ],
    escalate:
      "Refunds, restoration disputes, transfer authorization codes and changes to the registered owner go to the administrator.",
  },
  {
    id: "business-email",
    title: "Set up professional business email",
    tags: ["email", "mailbox", "mail", "mx", "spf", "dkim", "dmarc", "webmail"],
    route: "/business/email",
    summary:
      "JKTL Business Email needs a domain, reviewed mailbox details, domain verification and completed licensed provisioning.",
    steps: [
      "Open Business Email in your workspace. Review the current available plans or your organization’s agreed quote. The public catalogue does not guarantee checkout is open for every plan.",
      "Read mailbox quantity, storage, billing period, included assistance and any agreed scope note. Domain registration is separate unless a reviewed agreement explicitly includes it.",
      "Enter the domain you control and the requested mailbox addresses, such as hello@yourdomain. Check spelling and the plan’s mailbox limit. Avoid duplicate addresses.",
      "Read and accept the email-service terms yourself. If payment is unavailable, submit an enquiry rather than using an unrelated checkout. Paid licensing and service readiness must be confirmed before purchase opens.",
      "After a verified payment, follow the domain-ownership TXT instructions in the email workspace. Copy the exact host/name and token. The record must be added at the DNS provider that currently controls the domain.",
      "Use Verify domain after saving the TXT record. A verification error can mean the record is missing, under the wrong name or still cached. Do not delete other TXT records while troubleshooting.",
      "Wait for setup status to show the actual provisioning stage. The team records the licensed service, DNS instructions and confirmed mailbox allocations. Payment alone does not create a working inbox.",
      "Review MX, SPF, DKIM and DMARC instructions with the existing DNS configuration. There should be one valid SPF policy for a name; do not add a second competing SPF record or remove unrelated mail records without review.",
      "Use the secure activation or webmail link shown after setup. Set your mailbox password through that provider’s protected flow. JKTL support must never collect, store or email the mailbox password.",
      "Test sending and receiving with another email provider, including replies and spam folders. If one direction fails, report the address involved and time, without forwarding private inbox contents to a public chat.",
    ],
    problems: [
      "Domain verification fails: compare the exact TXT host and value, and ensure you are editing the active DNS zone.",
      "Paid but no mailbox access yet: check service status and requested/allocated mailbox counts. Allocation metadata and an activated inbox are different.",
      "Messages go to spam: inspect SPF/DKIM/DMARC and ask for a domain configuration review; never promise guaranteed inbox placement.",
      "Existing free mailbox: linking it does not convert it into paid hosting or silently migrate it. Any fee or migration needs a separately accepted agreement.",
    ],
    escalate:
      "Mailbox deletion, migration, DNS replacement, licensing, billing disputes and password resets require the authorized provisioning/admin path. Password changes happen only through secure provider links.",
  },
  {
    id: "payments",
    title: "Pay safely and troubleshoot an unfinished payment",
    tags: [
      "pay",
      "payment",
      "paystack",
      "checkout",
      "charge",
      "debit",
      "pending",
      "failed",
    ],
    route: "/business/settings?tab=infrastructure",
    summary:
      "Only a verified provider charge can mark an order paid. Screenshots and browser redirects are not a substitute for verification.",
    steps: [
      "Open the relevant product inside your Business account: Plans, Domains, Business Email or Custom. Confirm you are in the correct business and order.",
      "Read the exact product, amount, currency, billing period and terms before opening checkout. Different services can have different periods and renewal rules.",
      "Use the secure payment link created by the application. Never send money to an agent’s personal bank account or share your card number, CVV, bank password or OTP in support chat.",
      "Complete any bank authentication yourself. An agent can describe the next screen but cannot authorize a debit on your behalf.",
      "Return to the Business workspace after checkout. Use the status/verification control for the existing order and keep the payment reference.",
      "If debited but still pending, wait for provider verification and request help with that same reference. Do not immediately pay again; duplicate attempts can create separate charges.",
      "If the payment failed or was abandoned, use the application’s retry/resume flow when it becomes eligible. A cancelled order paid late may need administrator review rather than automatic fulfilment.",
      "For invoices, identify which service the invoice covers and the payable total. An invoice paid to JKTL Custom does not automatically buy a domain or email plan.",
      "Review the confirmed status and receipt/history in the relevant workspace. A screenshot supplied by either a customer or an agent cannot change the ledger.",
      "Ask human support to trace the stage if needed. Give the reference, product, amount and approximate time; never give banking credentials.",
    ],
    problems: [
      "Bank debited, order pending: keep the reference and ask for verification. Do not create another order as a workaround.",
      "Wrong amount or currency: stop before payment. An administrator must review the quote/order; support cannot edit a paid ledger.",
      "Paid order needs review: the team must reconcile it. No assistant should promise an automatic refund or mark it fulfilled without evidence.",
    ],
    escalate:
      "Refunds, duplicate-charge reconciliation, manual payment overrides, changed amounts, bank details and disputed purchases go to an owner administrator.",
  },
  {
    id: "plans",
    title: "Upgrade without losing the selected template",
    tags: [
      "plan",
      "upgrade",
      "pricing",
      "subscription",
      "billing",
      "free",
      "paid",
    ],
    route: "/business/plans",
    summary:
      "Upgrades apply to the existing website/workspace. Keep your current template and content rather than starting again.",
    steps: [
      "Open Plans in the same Business workspace that contains your website. Check the business name and current selected template first.",
      "Compare the current plan features, billing interval, currency and total due. Use the live pricing screen; an old screenshot or chatbot answer is not a current quote.",
      "Read what is included and what is separate. Domains, Business Email, AI receptionist services and custom work can have their own charges and terms.",
      "Choose the upgrade from the existing workspace. The flow should retain your selected template and content. If it starts a new template-selection flow unexpectedly, stop before confirming replacement.",
      "Review the checkout total and interval yourself. Do not assume that clicking a plan card authorizes every future optional service.",
      "Complete secure checkout and return to the workspace for verification. The same payment-verification rules apply as for other orders.",
      "Reload the existing editor once the new plan is confirmed. Check that the template identifier, saved content and published address are still correct.",
      "Keep the confirmation/reference and request support if features remain unavailable. Do not delete or recreate the website to force a plan refresh.",
    ],
    problems: [
      "Asked to select a template again: confirm the account/business and retain the current template name. Ask support to inspect the existing upgrade journey.",
      "Plan not updated after debit: verify the existing payment before retrying.",
      "Need cancellation or refund: use the relevant terms and administrator review. Domain, email and custom-service charges are not automatically covered by website-plan terms.",
    ],
    escalate:
      "An owner administrator reviews billing changes, refunds and entitlement discrepancies. Support may explain the screen but cannot upgrade an account without verified authorization/payment.",
  },
  {
    id: "refunds",
    title: "Understand the website-plan guarantee",
    tags: ["refund", "guarantee", "cancel", "14-day", "chargeback"],
    route: "/business/plans",
    summary:
      "The 14-day money-back guarantee applies to the first paid website-plan purchase under the published terms; it is not a blanket guarantee for every service.",
    steps: [
      "Locate the original purchase in the relevant workspace and identify whether it is a website plan, domain, email service or custom project.",
      "Read the published website-guarantee terms and check the first paid website-plan purchase date. Renewal, upgrades and separately scoped products can have different terms.",
      "Create a support request with the product, payment reference and reason. Do not include card details, bank login information or an OTP.",
      "The request will be escalated for administrator review because support agents cannot decide or move refunds.",
      "Keep the original order and receipt. Do not cancel a pending order merely to erase a successful charge or send a second payment hoping to reverse the first.",
      "Wait for a written decision and the recorded refund status. Processing times depend on the provider/bank; no bot or support agent should promise an exact completion time without evidence.",
      "If a refund is approved, follow the original payment-provider process. Never pay a release fee to an agent or disclose credentials to receive a refund.",
    ],
    problems: [
      "Purchased a domain or email: read that product’s terms; do not assume the website guarantee applies.",
      "Two charges for one intended purchase: provide both references and ask for reconciliation before taking another action.",
      "Someone promises an instant refund in chat: an administrator and the actual payment record must confirm it.",
    ],
    escalate:
      "All refund and chargeback requests require an owner administrator. The assistant cannot approve, reject or execute a refund.",
  },
  {
    id: "access",
    title: "Sign in, recover access and protect ownership",
    tags: [
      "login",
      "password",
      "otp",
      "owner",
      "email",
      "security",
      "access",
      "account",
    ],
    route: "/login",
    summary:
      "Keep account access and business ownership separate from routine website editing. Support never needs your credentials.",
    steps: [
      "Use the Business sign-in page for a business account, /admin/login for team operators, /partners/login for partners or the affiliate sign-in for affiliates. These are different account types.",
      "Check the email spelling and the account type before resetting a password. An application awaiting programme approval may not have dashboard access yet.",
      "Use the password-reset link provided by the relevant sign-in page. Follow the secure link yourself; never forward it to an agent or paste it into chat.",
      "If you cannot receive email, check spam and whether you still control the mailbox. Ask an administrator for the verified recovery process if ownership cannot be established through the normal flow.",
      "Do not create duplicate accounts to resolve an ownership issue. Record the business name, public website address and the access problem, without sharing identity documents in the public assistant.",
      "For a suspected compromise, use a trusted device, change credentials through secure account controls and request immediate administrator review. Do not follow payment or password instructions from an unsolicited message.",
      "Support can explain navigation but cannot change account email, passwords, owner membership or payout details. Sensitive recovery is escalated and may require verification outside routine chat.",
      "After recovery, review logged-in devices and authorized team members through the available settings. Sign out of shared devices and protect the email account used for recovery.",
    ],
    problems: [
      "Wrong portal: use the sign-in page for the account type you registered.",
      "Account appears empty: check whether you are in the demo, another business or a different email account.",
      "Asked for an OTP or password by support: do not provide it; escalate to an administrator.",
    ],
    escalate:
      "Account recovery, owner changes, compromised accounts, deletion and private identity verification always require higher authority.",
  },
  {
    id: "support-permissions",
    title: "AI help, human takeover and assisted website changes",
    tags: [
      "support",
      "human",
      "agent",
      "permission",
      "consent",
      "help",
      "handoff",
    ],
    route: "/business/help",
    summary:
      "The guide assistant answers first. You can request a human at any time; the same conversation then stays with the support team.",
    steps: [
      "Open Help & support in your Business workspace. Describe what you were trying to do, which screen you used and the exact error. Do not paste passwords, card numbers, API keys or private customer records.",
      "Read the assistant’s answer and linked detailed guide. It uses the JKTL knowledge library, not a promise that your account has already been changed.",
      "Choose Talk to a person if the steps do not solve the issue or you prefer human help. Your conversation is retained so you do not need to repeat the entire problem.",
      "Once human help is requested, the automated responder stops posting into that case. A waiting case is not a promise that an agent is immediately online.",
      "An assigned agent can explain account screens and send the relevant workspace link. Routine assistance does not grant general access to your business records.",
      "If you want website assistance, the business owner can grant permission for this case. Draft permission allows the assigned agent to inspect and edit the website document. Publishing permission is a separate choice for the first free publication.",
      "Each grant expires after 24 hours and is checked again for every action. You can revoke it immediately from the conversation. Permission applies to this business and case, not every account you own.",
      "Review the proposed website content and changes. The agent cannot silently replace an existing template, overwrite a concurrently saved revision or make a paid purchase.",
      "Sensitive requests are escalated to an owner administrator. Ordinary support cannot change credentials, owner memberships, payment records, pricing, domain ownership or mailbox provisioning.",
      "After the issue is resolved, review the outcome and close the case. You can read your conversation later; internal staff notes are not published to customers.",
    ],
    problems: [
      "Cannot grant permission: only the active business owner can authorize account changes. Staff can still ask for guidance.",
      "Agent cannot save: check assignment, case status, permission expiry and website revision. Do not bypass a failed check.",
      "Issue remains unresolved: request escalation in the same case and include what you already tried.",
    ],
    escalate:
      "Escalate any financial, security, identity, destructive DNS or deletion request. Permission to edit website copy is never permission to move money or change ownership.",
  },
  {
    id: "pwa",
    title: "Install JKTL and enable notifications",
    tags: [
      "pwa",
      "install",
      "download",
      "notifications",
      "push",
      "iphone",
      "android",
    ],
    route: "/business/settings",
    summary:
      "JKTL is installed from the browser as a PWA. Notification permission and device registration are separate, voluntary steps.",
    steps: [
      "Open the correct JKTL workspace over HTTPS in a supported browser. A normal browser tab still works even if installation is unavailable.",
      "On iPhone or iPad, open the site in Safari, use Share, then Add to Home Screen. Open the new home-screen icon before enabling push notifications on iOS.",
      "On Android or desktop Chromium, use the browser Install app/Add to Home screen option when offered. If the install button is unavailable, follow the browser’s menu instructions rather than downloading an unknown APK.",
      "Sign in with the correct account after installation. Support operators should install from /admin/support so the support app opens the staff inbox, not a customer workspace.",
      "Enable notifications only by pressing the workspace’s notification button. Accept the browser permission prompt if you want alerts. Installing alone does not grant notification permission.",
      "For a business account, review notification preferences in Settings → Account. For a support operator, use Enable support alerts in the support inbox; each staff device is registered against its active admin session.",
      "If permission was denied, the browser will not necessarily ask again. Open site permissions in the browser/device settings, allow notifications there and then enable the relevant workspace notifications again.",
      "Check the device’s focus/do-not-disturb mode and OS notification settings. Private browsing and some in-app browsers do not support the full install/push flow.",
      "Push requires JKTL’s notification service to be configured. If the app reports that it is unavailable, the support inbox and in-app conversation remain the source of truth; do not assume an alert was delivered.",
      "On shared devices, sign out when finished. Support alerts contain a generic queue notice, not customer messages or payment details. A disabled/expired staff session must not continue receiving support notifications.",
    ],
    problems: [
      "No install option: check browser support and whether the app is already installed; use the manual home-screen instructions.",
      "No notification prompt on iPhone: launch the installed home-screen app and check iOS/browser support.",
      "Notifications stopped: re-enable them after reviewing permissions and your sign-in session; keep checking the inbox meanwhile.",
    ],
    escalate:
      "Ask support for notification-delivery failures with device/browser details. Never send push subscription keys or browser session tokens in chat.",
  },
  {
    id: "reviews",
    title: "Share feedback and control public review consent",
    tags: [
      "review",
      "feedback",
      "testimonial",
      "rating",
      "consent",
      "withdraw",
    ],
    route: "/business/help",
    summary:
      "JKTL saves all ratings for feedback. Only explicitly consented reviews selected by an authorized moderator appear on the main site.",
    steps: [
      "You can leave feedback from Help & support. A periodic invitation may also appear after website publishing or a completed first domain purchase.",
      "Choose an honest rating and describe what worked or what needs improvement. A good review is not required to keep using your free website or receive support.",
      "Avoid customer names, private phone numbers, account identifiers and payment references in a public review. Use your business display name and the name you are comfortable sharing.",
      "Read the optional permission to publish. Without that permission, the feedback remains private to the authorized review team even if the rating is five stars.",
      "Submission saves the original wording and rating for moderation. Publication is not automatic, and an agent cannot change your words into a more favourable review.",
      "The main site labels the collection as selected customer reviews. It must not present a curated set as an overall average for all customers or invent results from an unrelated project.",
      "A reminder does not appear after every action. Submitted feedback pauses new invitations for 90 days; dismissing an invitation pauses it for 45 days.",
      "You can withdraw a review from the feedback history in Help & support. It is removed from the public feed immediately; already-open pages can take a refresh to stop displaying it.",
      "If you wish to submit an updated review, write the new feedback yourself. The review team should not publish edited wording without fresh consent.",
      "If the feedback describes an unresolved account issue, open a support case too. A review alone does not start a payment dispute or authorize an account change.",
    ],
    problems: [
      "Review is not visible publicly: check consent and moderation status. Not every submission becomes a featured testimonial.",
      "Want it removed: use Withdraw in your own feedback history.",
      "Not ready to review: dismiss the invitation. Support and free website access remain available.",
    ],
    escalate:
      "Ask an owner administrator about privacy or moderation disputes. Support must not offer access, refunds or priority assistance in exchange for a positive rating.",
  },
  {
    id: "daily-tools",
    title: "Use customer, booking, invoice and stock tools",
    tags: [
      "customer",
      "booking",
      "invoice",
      "sales",
      "stock",
      "inventory",
      "services",
      "products",
    ],
    route: "/business",
    summary:
      "JKTL Business combines free websites and landing pages with customer records, bookings, invoices, sales, inventory and everyday business tools. Domains, Business Email and AI receptionist services are separately scoped. Labels depend on your industry.",
    steps: [
      "Use the business name in the workspace to confirm you are working in the correct account. Your public website and private customer records are different parts of the product.",
      "Set up Services or Products before creating bookings or sales, using the correct names and integer currency amounts shown by the form. Do not use a website template’s sample prices as your real catalogue.",
      "Add customers only when you have a lawful business reason to store their information. Use minimal data and keep sensitive notes out of public website sections and support conversations.",
      "When creating a booking, review the customer, service, date, time and status before saving. JKTL’s business scheduling guidance uses Nigeria time where indicated; verify the displayed timezone rather than relying on your device clock alone.",
      "For invoices, verify the customer, items and payable amount before sending. A draft is not proof the customer received or paid it. Payment verification follows the invoice’s own workflow.",
      "For stock, record the actual product and quantity and review the resulting balance. Do not change a large set of products while someone else is recording sales without coordinating.",
      "Use the available team roles and active-member settings to control who can operate the business. A JKTL support role is separate from your own business’s staff membership.",
      "If a record seems missing, check filters, dates and the active business before recreating it. Recreating an invoice or sale can produce duplicates.",
      "When requesting help, describe the screen and the error. Do not give a support operator unrestricted exports of customer records; website assistance permission does not grant access to those records.",
    ],
    problems: [
      "Cannot see a menu: check More, your industry’s labels and your business role.",
      "A payment or record is missing: check the date/filter and reference first, then request account-owner review.",
      "Need bulk import or data correction: preserve a copy, check supported columns and request scoped help rather than pasting private files into chat.",
    ],
    escalate:
      "Private customer data, financial corrections, irreversible imports/deletions and membership changes require the business owner or an authorized administrator.",
  },
  {
    id: "partners",
    title: "Affiliate and partner applications, approval and sign-in",
    tags: [
      "affiliate",
      "partner",
      "commission",
      "referral",
      "approve",
      "agency",
    ],
    route: "/partners/login",
    summary:
      "Affiliates introduce JKTL to audiences; partners work directly with clients. Programme accounts and agreements are separate from customer Business accounts.",
    steps: [
      "Choose the appropriate programme. Creators, influencers and educators generally use Affiliates; developers, agencies, consultants and CAC agents serving clients generally use Partners.",
      "Apply using an email you control and a secure password. Describe your business and the clients you serve. Registration is an application, not automatic approval.",
      "Use the correct sign-in page after approval: Partners use /partners/login and affiliates use their affiliate portal. A customer Business login does not replace a programme account.",
      "For partners, wait for an agreed commission rate and written qualifying-purchase terms. Do not assume the affiliate bonus model applies to a negotiated partner agreement.",
      "After approval, copy the referral link from the programme workspace and test that it opens the intended public page. Do not publish someone else’s referral code.",
      "When helping clients create Business accounts, let the client use their own email and control their credentials. Obtain their permission before creating or changing their website.",
      "Track qualifying referrals and earnings through the portal. A click, signup, held bonus, payable commission and completed payout are distinct states.",
      "Use the portal’s payout-request process and the applicable programme terms. Staff support cannot change payout bank details, release held commissions or invent an earning.",
      "For an earlier enquiry without a password, follow the secure setup/reset instructions after the application is approved. Never accept a reusable password emailed by an operator.",
    ],
    problems: [
      "Application pending: wait for programme review; do not create duplicate applications.",
      "Wrong sign-in: use the portal for the programme you joined.",
      "Missing commission: provide the referral/reference and qualifying purchase information for authorized review, not the customer’s card data.",
    ],
    escalate:
      "Approval, commission disputes, payout changes and bank-detail changes go to the programme manager or owner administrator.",
  },
  {
    id: "ai-receptionist",
    title: "Understand AI receptionist setup and support",
    tags: [
      "ai",
      "receptionist",
      "call",
      "sms",
      "automation",
      "chatbot",
      "voice",
      "phone",
    ],
    route: "/business/receptionist",
    summary:
      "The business receptionist is a separately configured customer-facing service. It is different from JKTL’s platform-support assistant.",
    steps: [
      "Open Receptionist in your Business workspace and inspect the current configuration, service availability and plan before changing anything.",
      "Review the business name, contact information, services, hours and the fallback/escalation contact. The assistant should not promise a service or appointment that is not configured.",
      "Read the current activation, phone-line and communication-credit requirements. The free website does not mean every voice, SMS or AI service is free.",
      "Follow the activation and number/forwarding instructions shown for your account. A completed payment alone does not prove a phone number or provider service is ready.",
      "Use a permitted test call or website conversation after configuration. Check the greeting, business facts, booking options and the handoff path.",
      "Verify a test booking in the real business calendar rather than accepting only the assistant’s confirmation text. Prevent duplicate bookings while testing.",
      "Keep the escalation contact reachable. For clinical or other sensitive industries, the specialized receptionist’s safety and urgent-handoff rules remain separate from general website support.",
      "If the model/provider is unavailable, the product may use a scripted fallback. Do not advertise an untested integration or guaranteed response for every circumstance.",
      "For a problem, record the time, channel and non-sensitive session reference. Do not paste patient information, customer conversations or provider API credentials into platform support.",
    ],
    problems: [
      "No responses: check activation/configuration and communication availability before testing again.",
      "Wrong business facts: correct the authoritative business/service settings; a website headline alone may not update receptionist configuration.",
      "Need provider credentials or number changes: request specialist assistance instead of sharing keys in chat.",
    ],
    escalate:
      "Activation, provider credentials, automatic charges, phone-number changes and sensitive conversation/data incidents require authorized administrators or specialists.",
  },
  {
    id: "metrics",
    title: "Read website and landing-page metrics",
    tags: [
      "metrics",
      "analytics",
      "traffic",
      "visitors",
      "conversion",
      "landing",
      "published",
    ],
    route: "/business/website/metrics",
    summary:
      "Metrics belong to the selected published site or landing page. A template preview is not customer traffic or a completed sale.",
    steps: [
      "Open Website metrics for the active business and confirm which site or landing page is published.",
      "Select the available date range and compare it with the publication date. A newly published site can correctly show little or no traffic.",
      "Open the actual public address on a separate device to confirm the page and its tracked interactions work. Do not use an editor or template-gallery preview as the public address.",
      "Distinguish page views, visits and interaction events as labelled by the screen. Clicking a contact button is not proof a sale was completed.",
      "Account for bot filtering, blocked scripts and repeated visits when interpreting counts. Do not compare unlabelled numbers as if they measured the same thing.",
      "If you change templates, keep the site/business identity and check the published version. Upgrading does not mean you must start a new template or fabricate historical activity.",
      "Use trends over a reasonable period to improve headings, contact clarity and mobile layout. Never add fake reviews or invented customer counts to make a quiet site look established.",
      "For a discrepancy, send the exact page address, date range, event you expected and approximate test time. Keep customer identities out of the support transcript.",
    ],
    problems: [
      "No activity: verify the published address and date range first.",
      "Preview looks active but metrics are empty: preview traffic is not the same as a published site’s visitors.",
      "Clicks exceed actual customers: interaction counts and confirmed bookings/payments are different measures.",
    ],
    escalate:
      "Ask authorized support to inspect tracking behavior. Financial/booking reconciliation still requires the underlying verified records, not website traffic counts.",
  },
  {
    id: "appearance",
    title: "Switch language, theme and the active workspace",
    tags: [
      "language",
      "hausa",
      "igbo",
      "yoruba",
      "english",
      "dark",
      "light",
      "theme",
      "workspace",
    ],
    route: "/business/settings",
    summary:
      "Main and Business have their own theme controls. Browser preferences can also affect appearance; account identity still comes from sign-in.",
    steps: [
      "Use the language selector to choose English, Hausa, Igbo or Yoruba where offered. Product names, user-written text and third-party checkout pages may not be translated in the same way as navigation.",
      "Use the theme icon in the Business header/sidebar to choose Light, Dark or Use device setting. The setting also appears under Settings → Account → Appearance.",
      "Use device setting follows the browser/OS preference. Light or Dark explicitly overrides it in that application. A main-site selection is not proof you changed the separate Business application.",
      "Reload once to check that the chosen appearance is retained. Browser storage restrictions can prevent persistence; the current visit should still remain usable.",
      "If a field looks unreadable, report the exact page, theme, browser and device width. Do not use a screenshot containing private customer data.",
      "Check the business name and account type after switching pages. A colour or language change does not switch to another organization or grant access.",
      "Published customer websites keep their own design colours. Changing your Business dashboard theme must not recolour the customer’s chosen website template.",
      "On a shared device, sign out after use. Language and theme preferences are not security controls and do not replace signing out.",
    ],
    problems: [
      "Dark on Main but not Business: select Dark using the Business theme control too.",
      "Some content remains English: distinguish interface translations from user-entered text and provider pages.",
      "A screenshot shows the wrong business: check the current workspace before editing or buying anything.",
    ],
    escalate:
      "Contact support for an unreadable or inaccessible control. Ownership and account-access issues follow the separate administrator recovery process.",
  },
  {
    id: "business-add-customer",
    title: "How do I add a customer?",
    tags: ["customers"],
    route: "/business/customers",
    summary: "Using your own business tools: How do I add a customer?",
    steps: [
      "Go to Customers and tap the + button. Fill in their name and (optionally) phone, email and notes, then save.",
      "You don't have to add a customer to record a sale — walk-in sales without an account are fine too.",
    ],
    problems: [
      "Confirm the active business, role and date/filter before creating another record.",
      "If a save fails, keep a local copy of your work and follow the displayed error. Do not ask an agent to bypass role or payment verification.",
    ],
    escalate:
      "Support can explain these business tools. Changes to private customer records, money, account ownership or irreversible deletion require the business owner or an authorized administrator; the scoped Support website tool cannot make them.",
  },
  {
    id: "business-customer-history",
    title: "Where do I see a customer's past bookings and sales?",
    tags: ["customers"],
    route: "/business/customers",
    summary:
      "Using your own business tools: Where do I see a customer's past bookings and sales?",
    steps: [
      "Open the customer from the Customers list — their page shows a combined history of every booking and sale linked to them, most recent first.",
    ],
    problems: [
      "Confirm the active business, role and date/filter before creating another record.",
      "If a save fails, keep a local copy of your work and follow the displayed error. Do not ask an agent to bypass role or payment verification.",
    ],
    escalate:
      "Support can explain these business tools. Changes to private customer records, money, account ownership or irreversible deletion require the business owner or an authorized administrator; the scoped Support website tool cannot make them.",
  },
  {
    id: "business-add-booking",
    title: "How do I schedule a booking?",
    tags: ["bookings"],
    route: "/business/bookings",
    summary: "Using your own business tools: How do I schedule a booking?",
    steps: [
      "Go to Bookings and tap the + button. Pick the customer, service, staff member and time, then save.",
      "Bookings move through statuses — pending, confirmed, completed, cancelled or no-show — which you can update from the booking itself.",
    ],
    problems: [
      "Confirm the active business, role and date/filter before creating another record.",
      "If a save fails, keep a local copy of your work and follow the displayed error. Do not ask an agent to bypass role or payment verification.",
    ],
    escalate:
      "Support can explain these business tools. Changes to private customer records, money, account ownership or irreversible deletion require the business owner or an authorized administrator; the scoped Support website tool cannot make them.",
  },
  {
    id: "business-booking-email",
    title: "Does a customer get notified about their booking?",
    tags: ["bookings"],
    route: "/business/bookings",
    summary:
      "Using your own business tools: Does a customer get notified about their booking?",
    steps: [
      'When a booking\'s status is set to "confirmed" and the customer has an email on file, JKTL Business automatically emails them a confirmation with the service, date and time.',
    ],
    problems: [
      "Confirm the active business, role and date/filter before creating another record.",
      "If a save fails, keep a local copy of your work and follow the displayed error. Do not ask an agent to bypass role or payment verification.",
    ],
    escalate:
      "Support can explain these business tools. Changes to private customer records, money, account ownership or irreversible deletion require the business owner or an authorized administrator; the scoped Support website tool cannot make them.",
  },
  {
    id: "business-record-sale",
    title: "How do I record a sale?",
    tags: ["sales"],
    route: "/business/sales",
    summary: "Using your own business tools: How do I record a sale?",
    steps: [
      'Go to Sales and tap "New sale". Pick the customer (or leave it as a walk-in), add each service or product sold, apply a discount if needed, and choose a payment method and status.',
      "The total is calculated for you as you add items.",
    ],
    problems: [
      "Confirm the active business, role and date/filter before creating another record.",
      "If a save fails, keep a local copy of your work and follow the displayed error. Do not ask an agent to bypass role or payment verification.",
    ],
    escalate:
      "Support can explain these business tools. Changes to private customer records, money, account ownership or irreversible deletion require the business owner or an authorized administrator; the scoped Support website tool cannot make them.",
  },
  {
    id: "business-partial-payment",
    title: "A customer only paid part of the bill — what do I do?",
    tags: ["sales"],
    route: "/business/sales",
    summary:
      "Using your own business tools: A customer only paid part of the bill — what do I do?",
    steps: [
      'Set the sale\'s payment status to "Partial" — a field appears for how much they paid right now, and the app shows the balance still owing.',
      "The sale is saved with that balance outstanding, so nothing forces you to guess or round up.",
    ],
    problems: [
      "Confirm the active business, role and date/filter before creating another record.",
      "If a save fails, keep a local copy of your work and follow the displayed error. Do not ask an agent to bypass role or payment verification.",
    ],
    escalate:
      "Support can explain these business tools. Changes to private customer records, money, account ownership or irreversible deletion require the business owner or an authorized administrator; the scoped Support website tool cannot make them.",
  },
  {
    id: "business-complete-payment",
    title:
      "How do I record the rest of the payment once a customer pays in full?",
    tags: ["sales"],
    route: "/business/sales",
    summary:
      "Using your own business tools: How do I record the rest of the payment once a customer pays in full?",
    steps: [
      'Open the sale from the Sales list, then tap "Update payment". Enter the new total amount paid — if it covers the full price, the sale automatically flips to "Paid".',
      "You can come back and do this as many times as needed until it's settled.",
    ],
    problems: [
      "Confirm the active business, role and date/filter before creating another record.",
      "If a save fails, keep a local copy of your work and follow the displayed error. Do not ask an agent to bypass role or payment verification.",
    ],
    escalate:
      "Support can explain these business tools. Changes to private customer records, money, account ownership or irreversible deletion require the business owner or an authorized administrator; the scoped Support website tool cannot make them.",
  },
  {
    id: "business-receipt-photo",
    title: "Can I attach a photo of the paper receipt?",
    tags: ["sales"],
    route: "/business/sales",
    summary:
      "Using your own business tools: Can I attach a photo of the paper receipt?",
    steps: [
      "Yes — it's optional. When recording or updating a sale, there's an \"Add a photo of the receipt\" option. Tap it to take a photo or choose one from your gallery.",
      "It's saved with the sale, so you (or your team) can always pull it up later from the sale's page.",
    ],
    problems: [
      "Confirm the active business, role and date/filter before creating another record.",
      "If a save fails, keep a local copy of your work and follow the displayed error. Do not ask an agent to bypass role or payment verification.",
    ],
    escalate:
      "Support can explain these business tools. Changes to private customer records, money, account ownership or irreversible deletion require the business owner or an authorized administrator; the scoped Support website tool cannot make them.",
  },
  {
    id: "business-create-invoice",
    title: "How do I create an invoice?",
    tags: ["invoices"],
    route: "/business/invoices",
    summary: "Using your own business tools: How do I create an invoice?",
    steps: [
      "Go to Invoices and tap the + button. Add the customer, line items and due date. It starts as a draft until you're ready to send it.",
    ],
    problems: [
      "Confirm the active business, role and date/filter before creating another record.",
      "If a save fails, keep a local copy of your work and follow the displayed error. Do not ask an agent to bypass role or payment verification.",
    ],
    escalate:
      "Support can explain these business tools. Changes to private customer records, money, account ownership or irreversible deletion require the business owner or an authorized administrator; the scoped Support website tool cannot make them.",
  },
  {
    id: "business-send-invoice",
    title: "How do I send an invoice to a customer?",
    tags: ["invoices"],
    route: "/business/invoices",
    summary:
      "Using your own business tools: How do I send an invoice to a customer?",
    steps: [
      'Open the invoice and tap "Email invoice" to send it straight to the customer\'s email on file (this needs you to be online and signed in to a real account).',
      'You can also tap "Print / Download" to save or print it, or "Copy summary" to paste it into WhatsApp or SMS.',
    ],
    problems: [
      "Confirm the active business, role and date/filter before creating another record.",
      "If a save fails, keep a local copy of your work and follow the displayed error. Do not ask an agent to bypass role or payment verification.",
    ],
    escalate:
      "Support can explain these business tools. Changes to private customer records, money, account ownership or irreversible deletion require the business owner or an authorized administrator; the scoped Support website tool cannot make them.",
  },
  {
    id: "business-mark-invoice-paid",
    title: "How do I mark an invoice as paid?",
    tags: ["invoices"],
    route: "/business/invoices",
    summary: "Using your own business tools: How do I mark an invoice as paid?",
    steps: [
      'Open the invoice and tap "Mark as paid". If the customer has an email on file, they automatically get a payment confirmation email.',
    ],
    problems: [
      "Confirm the active business, role and date/filter before creating another record.",
      "If a save fails, keep a local copy of your work and follow the displayed error. Do not ask an agent to bypass role or payment verification.",
    ],
    escalate:
      "Support can explain these business tools. Changes to private customer records, money, account ownership or irreversible deletion require the business owner or an authorized administrator; the scoped Support website tool cannot make them.",
  },
  {
    id: "business-add-product",
    title: "How do I add a product to sell?",
    tags: ["stock"],
    route: "/business/inventory",
    summary: "Using your own business tools: How do I add a product to sell?",
    steps: [
      "Go to Products and tap the + button. Set its price, cost, starting stock and a low-stock threshold, so you get warned before you run out.",
    ],
    problems: [
      "Confirm the active business, role and date/filter before creating another record.",
      "If a save fails, keep a local copy of your work and follow the displayed error. Do not ask an agent to bypass role or payment verification.",
    ],
    escalate:
      "Support can explain these business tools. Changes to private customer records, money, account ownership or irreversible deletion require the business owner or an authorized administrator; the scoped Support website tool cannot make them.",
  },
  {
    id: "business-stock-movements",
    title: "How does stock get adjusted?",
    tags: ["stock"],
    route: "/business/inventory",
    summary: "Using your own business tools: How does stock get adjusted?",
    steps: [
      "Stock goes down automatically whenever a product is sold in a sale. You can also adjust it manually from Inventory — for new stock arriving, damage, or a stock count correction.",
      "Every change is logged so you can see the full history of a product's stock movements.",
    ],
    problems: [
      "Confirm the active business, role and date/filter before creating another record.",
      "If a save fails, keep a local copy of your work and follow the displayed error. Do not ask an agent to bypass role or payment verification.",
    ],
    escalate:
      "Support can explain these business tools. Changes to private customer records, money, account ownership or irreversible deletion require the business owner or an authorized administrator; the scoped Support website tool cannot make them.",
  },
  {
    id: "business-add-expense",
    title: "How do I record an expense?",
    tags: ["money"],
    route: "/business/reports",
    summary: "Using your own business tools: How do I record an expense?",
    steps: [
      "Go to Expenses and tap the + button. Choose a category (rent, electricity, staff, supplies, transport, marketing or other), enter the amount and date, and save.",
    ],
    problems: [
      "Confirm the active business, role and date/filter before creating another record.",
      "If a save fails, keep a local copy of your work and follow the displayed error. Do not ask an agent to bypass role or payment verification.",
    ],
    escalate:
      "Support can explain these business tools. Changes to private customer records, money, account ownership or irreversible deletion require the business owner or an authorized administrator; the scoped Support website tool cannot make them.",
  },
  {
    id: "business-reports",
    title: "What can I see in Reports?",
    tags: ["money"],
    route: "/business/reports",
    summary: "Using your own business tools: What can I see in Reports?",
    steps: [
      "Reports summarize your sales, bookings and top-selling services or products over a date range you choose (today, this week, this month, or a custom range) — useful for spotting trends without doing the maths yourself.",
    ],
    problems: [
      "Confirm the active business, role and date/filter before creating another record.",
      "If a save fails, keep a local copy of your work and follow the displayed error. Do not ask an agent to bypass role or payment verification.",
    ],
    escalate:
      "Support can explain these business tools. Changes to private customer records, money, account ownership or irreversible deletion require the business owner or an authorized administrator; the scoped Support website tool cannot make them.",
  },
  {
    id: "business-add-team-member",
    title: "How do I add a staff member?",
    tags: ["team"],
    route: "/business/settings",
    summary: "Using your own business tools: How do I add a staff member?",
    steps: [
      'Go to Settings → Users and tap "Add". They\'re added as a manager or staff member — only the account owner can be removed as "owner".',
    ],
    problems: [
      "Confirm the active business, role and date/filter before creating another record.",
      "If a save fails, keep a local copy of your work and follow the displayed error. Do not ask an agent to bypass role or payment verification.",
    ],
    escalate:
      "Support can explain these business tools. Changes to private customer records, money, account ownership or irreversible deletion require the business owner or an authorized administrator; the scoped Support website tool cannot make them.",
  },
  {
    id: "business-edit-business-details",
    title: "How do I change my business name, phone or address?",
    tags: ["team"],
    route: "/business/settings",
    summary:
      "Using your own business tools: How do I change my business name, phone or address?",
    steps: [
      'Go to Settings → Business and tap "Edit". Update any of the details and save — this is what shows on your invoices and confirmation emails.',
    ],
    problems: [
      "Confirm the active business, role and date/filter before creating another record.",
      "If a save fails, keep a local copy of your work and follow the displayed error. Do not ask an agent to bypass role or payment verification.",
    ],
    escalate:
      "Support can explain these business tools. Changes to private customer records, money, account ownership or irreversible deletion require the business owner or an authorized administrator; the scoped Support website tool cannot make them.",
  },
  {
    id: "business-change-password",
    title: "How do I change my password?",
    tags: ["team"],
    route: "/business/settings",
    summary: "Using your own business tools: How do I change my password?",
    steps: [
      'Go to Settings → Account → Password → "Change". You\'ll need to enter your current password once, then your new one twice to confirm.',
    ],
    problems: [
      "Confirm the active business, role and date/filter before creating another record.",
      "If a save fails, keep a local copy of your work and follow the displayed error. Do not ask an agent to bypass role or payment verification.",
    ],
    escalate:
      "Support can explain these business tools. Changes to private customer records, money, account ownership or irreversible deletion require the business owner or an authorized administrator; the scoped Support website tool cannot make them.",
  },
  {
    id: "business-forgot-password",
    title: "I forgot my password — how do I get back in?",
    tags: ["reset", "locked out", "recover", "team"],
    route: "/business/settings",
    summary:
      "Using your own business tools: I forgot my password — how do I get back in?",
    steps: [
      'On the sign-in page, tap "Forgot password?", enter the email on your account, and check your inbox — a reset link arrives if that email matches an account, and it works for 1 hour.',
      "Follow the link to choose a new password, then sign in as usual.",
    ],
    problems: [
      "Confirm the active business, role and date/filter before creating another record.",
      "If a save fails, keep a local copy of your work and follow the displayed error. Do not ask an agent to bypass role or payment verification.",
    ],
    escalate:
      "Support can explain these business tools. Changes to private customer records, money, account ownership or irreversible deletion require the business owner or an authorized administrator; the scoped Support website tool cannot make them.",
  },
  {
    id: "business-profile-photo",
    title: "How do I add a profile photo?",
    tags: ["team"],
    route: "/business/settings",
    summary: "Using your own business tools: How do I add a profile photo?",
    steps: [
      "Go to Settings → Account and tap the camera icon on your avatar. You can choose a photo from your phone or camera roll.",
    ],
    problems: [
      "Confirm the active business, role and date/filter before creating another record.",
      "If a save fails, keep a local copy of your work and follow the displayed error. Do not ask an agent to bypass role or payment verification.",
    ],
    escalate:
      "Support can explain these business tools. Changes to private customer records, money, account ownership or irreversible deletion require the business owner or an authorized administrator; the scoped Support website tool cannot make them.",
  },
  {
    id: "business-offline-banner",
    title: 'What does the "You\'re offline" banner mean?',
    tags: ["offline"],
    route: "/business/settings",
    summary:
      'Using your own business tools: What does the "You\'re offline" banner mean?',
    steps: [
      "It just means your phone or computer has no internet connection right now. You can keep using the app as normal — every screen still works, and anything you add or change is saved on your device.",
      'As soon as you\'re back online, a "Syncing…" banner appears briefly while those changes are sent up and confirmed.',
    ],
    problems: [
      "Confirm the active business, role and date/filter before creating another record.",
      "If a save fails, keep a local copy of your work and follow the displayed error. Do not ask an agent to bypass role or payment verification.",
    ],
    escalate:
      "Support can explain these business tools. Changes to private customer records, money, account ownership or irreversible deletion require the business owner or an authorized administrator; the scoped Support website tool cannot make them.",
  },
  {
    id: "business-sync-safety",
    title: "Is it safe to make changes while offline?",
    tags: ["offline"],
    route: "/business/settings",
    summary:
      "Using your own business tools: Is it safe to make changes while offline?",
    steps: [
      "Yes — every change is kept in order and applied exactly once when you're back online, even if the connection drops partway through a sync. Nothing is lost or duplicated.",
    ],
    problems: [
      "Confirm the active business, role and date/filter before creating another record.",
      "If a save fails, keep a local copy of your work and follow the displayed error. Do not ask an agent to bypass role or payment verification.",
    ],
    escalate:
      "Support can explain these business tools. Changes to private customer records, money, account ownership or irreversible deletion require the business owner or an authorized administrator; the scoped Support website tool cannot make them.",
  },
];
export function relevantGuides(question: string) {
  if (
    /what (?:is|does|can).*jktl|jktl.*(?:overview|features)|what.*business.*do/i.test(
      question,
    )
  )
    return ["daily-tools", "first-website", "ai-receptionist"].map((id) =>
      HELP_GUIDES.find((g) => g.id === id)!,
    );
  if (/industr(?:y|ies)/i.test(question))
    return ["templates", "first-website"].map((id) =>
      HELP_GUIDES.find((g) => g.id === id)!,
    );
  const normalized = question
    .toLowerCase()
    .replace(/\b(cost|costs|price|prices|fees)\b/g, "pricing")
    .replace(/\btemplates\b/g, "template");
  const terms =
    normalized
      .match(/[a-z0-9.]+/g)
      ?.filter(
        (t) =>
          t.length > 2 &&
          ![
            "the",
            "and",
            "for",
            "how",
            "with",
            "can",
            "you",
            "that",
            "this",
            "have",
            "want",
            "please",
            "jktl",
            "business",
            "help",
            "need",
            "not",
            "does",
          ].includes(t),
      ) || [];
  return HELP_GUIDES.map((g) => ({
    g,
    score: terms.reduce(
      (n, t) =>
        n +
        (g.title.toLowerCase().includes(t) ? 4 : 0) +
        (g.tags.some((k) => k.includes(t)) ? 5 : 0) +
        (g.steps.join(" ").toLowerCase().includes(t) ? 1 : 0),
      0,
    ),
  }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((r) => r.g);
}
export function guideReply(question: string) {
  const guides = relevantGuides(question);
  const g = guides[0] || HELP_GUIDES[0];
  return {
    guides: guides.length ? guides : [g],
    reply:
      g.summary +
      "\n\n" +
      g.steps
        .slice(0, 4)
        .map((s, i) => `${i + 1}. ${s}`)
        .join("\n\n") +
      "\n\nIf these steps do not solve it, request a human in Help & support. Never share passwords, OTPs or card details.",
  };
}
