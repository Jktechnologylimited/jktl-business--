/** Shared labels/copy only: no customer records or server configuration. */
export const BUSINESS_EMAIL_AUDIENCES = {
  BUSINESS_ACCOUNTS: "All business owners",
  NEW_BUSINESSES: "New business accounts — last 30 days",
  EXISTING_BUSINESSES: "Existing business accounts — over 30 days",
  FREE_SUBDOMAINS: "Published websites using a free subdomain",
  SELECTED_BUSINESSES: "Selected business owners",
} as const;
export type BusinessAudience = keyof typeof BUSINESS_EMAIL_AUDIENCES;
export const BUSINESS_OUTREACH_TEMPLATES = [
  {
    id:"founding-setup",title:"Founding customer — hands-on setup help",audience:"SELECTED_BUSINESSES",kind:"operational",subject:"Let’s get your business website ready together",
    body:"Hello,\n\nThank you for being one of JKTL Business’s early customers. I’d like us to help you get a website you are proud to share.\n\nReply with your business name, logo or brand colours, public contact details, the services or products you want to feature, and any photos or website examples you like. Tell us what you want visitors to do: contact you, book a service, or make an enquiry.\n\nWe can help you choose a template, organise your content, check the site on phone and desktop, and show you how to update it. You can launch with your free JKTL subdomain. If a custom domain or business email would help, we can discuss the available options and prices first.\n\n[Open JKTL Business support](https://business.jktl.com.ng/business/help) if you need hands-on editing assistance. We’ll use the support permissions you approve. Please don’t send passwords, card details or verification codes.\n\nYour feedback will help us improve. Our support does not depend on a review or permission to use your business publicly."
  },
  {
    id: "welcome",
    title: "Welcome & setup help",
    audience: "NEW_BUSINESSES",
    kind: "operational",
    subject: "Welcome to JKTL Business — let’s help you get set up",
    body: "Hello,\n\nWelcome to JKTL Business. We’re here to help you get your account and website set up.\n\nYou can [sign in to your account](https://business.jktl.com.ng) to choose a template, update your website and review your account settings.\n\nIf you’re stuck or have a question about using your account, reply to this email and tell us where you need help. Our team will get back to you.",
  },
  {
    id: "check-in",
    title: "Account support check-in",
    audience: "BUSINESS_ACCOUNTS",
    kind: "operational",
    subject: "How can we help with your JKTL Business account?",
    body: "Hello,\n\nWe’re checking in to see how your JKTL Business account setup is going.\n\nDo you need help choosing a template, editing or publishing your website, signing in, or understanding your account settings?\n\nReply to this email with your question or the step you’re having trouble with. You can also [open your account](https://business.jktl.com.ng). Please don’t send passwords, card details or verification codes.",
  },
  {
    id: "domain-upgrade",
    title: "Custom domain upgrade",
    audience: "FREE_SUBDOMAINS",
    kind: "marketing",
    subject: "Give your business website a domain of its own",
    body: "Hello,\n\nReady to give your website a domain that reflects your business name?\n\nWith JKTL Business, you can explore a custom domain or connect one you already own. Your website content can stay in place while you set up your domain.\n\n[Explore domains in JKTL Business](https://business.jktl.com.ng/business/domains). Availability and pricing are shown when you search.\n\nIf you’d like help choosing or connecting a domain, reply to this email and our team will help you with the next steps.",
  },
] as const;
