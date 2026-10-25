/** NGN launch catalogue. Amounts are integer kobo; no inferred exchange rates. */
export type PlanId = "free" | "starter" | "growth" | "business" | "elite";
export type WebsiteBillingInterval = "monthly" | "yearly";
export const PRICING_MARKETS = {
  NG: { currency: "NGN", locale: "en-NG" },
} as const;
export const WEBSITE_PLANS = [
  {
    id: "free",
    name: "Free",
    monthlyKobo: 0,
    yearlyKobo: 0,
    description: "Start your online presence",
    features: [
      "200 designs + two blank canvases",
      "One published website or landing page",
      "Free JKTL subdomain",
      "Managed hosting and SSL",
      "Responsive website editor",
      "JKTL branding",
      "Customer records and invoicing",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    monthlyKobo: 500000,
    yearlyKobo: 5000000,
    description: "Make your brand your own",
    features: [
      "Everything in Free",
      "Custom domain connection",
      "Remove JKTL branding",
      "Basic SEO settings",
      "Website enquiry forms¹",
      "Two collaborators",
      "Basic website analytics",
      "1 GB image storage",
      "Standard support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    monthlyKobo: 1500000,
    yearlyKobo: 15000000,
    description: "Sell, schedule and grow",
    features: [
      "Everything in Starter",
      "Paystack payment integration",
      "Products and services catalogue",
      "Appointment scheduling",
      "Inventory and expense tracking",
      "Expanded CRM and invoicing¹",
      "Five collaborators",
      "5 GB image storage",
      "Advanced website analytics¹",
    ],
  },
  {
    id: "business",
    name: "Business",
    monthlyKobo: 2900000,
    yearlyKobo: 29000000,
    description: "Bring your operations together",
    features: [
      "Everything in Growth",
      "AI website chatbot with usage limits¹",
      "Advanced CRM¹",
      "Expanded e-commerce¹",
      "Customer follow-up workflows¹",
      "Business automation¹",
      "Ten collaborators",
      "15 GB image storage",
      "Priority support¹",
    ],
  },
  {
    id: "elite",
    name: "Business Elite",
    monthlyKobo: 5900000,
    yearlyKobo: 59000000,
    description: "Support your next stage",
    features: [
      "Everything in Business",
      "25 collaborators",
      "30 GB image storage",
      "Multiple business locations¹",
      "Advanced staff permissions¹",
      "Advanced automation and reports¹",
      "Higher AI chatbot allowances¹",
      "Priority onboarding¹",
      "AI receptionist available separately",
    ],
  },
] as const;
export function websitePlanQuote(id: string, interval: string) {
  const plan = WEBSITE_PLANS.find((p) => p.id === id);
  if (!plan || (interval !== "monthly" && interval !== "yearly"))
    throw new Error("Unknown plan or billing interval");
  const amountKobo = interval === "yearly" ? plan.yearlyKobo : plan.monthlyKobo;
  return {
    planId: plan.id,
    currency: "NGN" as const,
    interval,
    amountKobo,
    monthlyEquivalentKobo:
      interval === "yearly" ? Math.round(amountKobo / 12) : amountKobo,
    savingsKobo: interval === "yearly" ? plan.monthlyKobo * 12 - amountKobo : 0,
  };
}
export function priceNGN(kobo: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);
}
/** Unpriced manual products never enter an automated checkout. */
export const DIGITAL_PRODUCTS = [
  {
    id: "domains",
    name: "Domains & Hosting",
    title: "Your name. Your space online.",
    description:
      "Register a domain, connect one you own, and publish with managed hosting.",
    details: [
      "Domain registration is manually provisioned after a quote and availability confirmation.",
      "Domain renewals are annual and separate from your website subscription.",
      "Managed website hosting and supported SSL are included with your website plan — no second hosting fee.",
      "Standalone hosting is quoted according to your requirements.",
    ],
  },
  {
    id: "business-email",
    name: "Business Email",
    title: "A professional address for every conversation.",
    description: "Build trust with an email address at your own domain.",
    details: [
      "Zoho business email is provisioned manually by the JKTL team.",
      "Choose the number of mailboxes you need, with annual subscriptions quoted separately.",
      "Provisioning steps: request → quote and payment → domain verification → mailbox setup → ready.",
      "Your quote confirms mailbox limits, annual price and renewal date before payment.",
    ],
  },
  {
    id: "business-tools",
    name: "Business Tools",
    title: "Keep your everyday work together.",
    description:
      "Manage your customers, invoices, appointments, stock and expenses in JKTL Business.",
    details: [
      "Existing customer records, invoicing, inventory, bookings and reporting remain available to current users.",
      "Paystack customer payments use your existing configured payment connection.",
      "Website views, contact clicks and booking conversions are available for published template sites.",
      "AI, automation and expanded plan allowances require separate activation; current access is preserved.",
    ],
  },
  {
    id: "add-ons",
    name: "AI & Add-ons",
    title: "Add capabilities when you need them.",
    description:
      "Discuss AI reception, website chat, missed-call recovery and additional capacity.",
    details: [
      "AI receptionist is a separately scoped product; existing contracts remain unchanged.",
      "Request a tailored quote covering setup, call and message usage, and the recurring subscription before you commit.",
      "AI chatbot, staff seats, storage and automation upgrades need a confirmed quote and explicit usage limits.",
      "No unlimited AI promise or automatic add-on activation. Existing usage and wallet controls remain in place.",
    ],
  },
  {
    id: "custom-websites",
    name: "JKTL Custom",
    title: "Made for your business, from the ground up.",
    description:
      "JKTL Custom Websites — from ₦350,000. Premium projects may start from ₦650,000.",
    details: [
      "Request a consultation to agree requirements, deliverables and a written quote.",
      "Custom development is separate from template subscriptions.",
      "Domain registration, hosting, email and maintenance charges are quoted separately.",
      "No recurring charge begins from a consultation request.",
    ],
  },
  {
    id: "managed-services",
    name: "JKTL Managed Services",
    title: "Ongoing care for your business online.",
    description:
      "Website maintenance, content management, technical support and infrastructure services with a tailored agreement.",
    details: [
      "Agree scope, service hours and individual pricing.",
      "Review separate infrastructure, maintenance and third-party costs.",
      "Accept the service proposal in your JKTL Custom workspace.",
      "Pay invoices and request support from one account.",
    ],
  },
] as const;
