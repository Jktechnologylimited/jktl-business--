export interface GuideCategory {
  id: string;
  label: string;
}

export interface GuideItem {
  id: string;
  category: string;
  question: string;
  /** Paragraphs — also doubles as the searchable body text. */
  answer: string[];
  /** Extra words to match on search that aren't in the question/answer text. */
  keywords?: string[];
  /** Marks an item whose answer is rendered by a custom component instead of plain paragraphs. */
  custom?: "add-to-home-screen";
}

export const GUIDE_CATEGORIES: GuideCategory[] = [
  { id: "started", label: "Getting started" },
  { id: "install", label: "Install the app" },
  { id: "customers", label: "Customers" },
  { id: "bookings", label: "Bookings" },
  { id: "sales", label: "Sales & payments" },
  { id: "invoices", label: "Invoices" },
  { id: "stock", label: "Products & inventory" },
  { id: "money", label: "Expenses & reports" },
  { id: "team", label: "Team & account" },
  { id: "offline", label: "Working offline" },
];

export const GUIDES: GuideItem[] = [
  // ---- Getting started ----
  {
    id: "what-is-this",
    category: "started",
    question: "What is JKTL Business?",
    answer: [
      "JKTL Business is a simple app for running your day-to-day business from your phone — customers, bookings, sales, invoices, stock and expenses, all in one place.",
      "It works even without a solid internet connection: you can keep working, and anything you do syncs to your account the next time you're back online.",
    ],
  },
  {
    id: "demo-vs-live",
    category: "started",
    question: "What's the difference between the demo and a real account?",
    answer: [
      "\"Open salon demo\" on the sign-in page loads a made-up salon with sample customers, bookings and sales, so you can try the app with no sign-up. Nothing you do there is saved anywhere or synced — it resets when you leave.",
      "A real account (created via \"Create account\") stores your actual business data securely and syncs it online, so it's there whenever you sign back in on any device.",
    ],
  },
  {
    id: "onboarding",
    category: "started",
    question: "I just signed up — what happens next?",
    answer: [
      "After you create an account, a short setup walks you through your business type, your business details, and adding your first service or item — so the app isn't empty on day one.",
      "You can change anything from that setup later in Settings.",
    ],
  },

  // ---- Customers ----
  {
    id: "add-customer",
    category: "customers",
    question: "How do I add a customer?",
    answer: [
      "Go to Customers and tap the + button. Fill in their name and (optionally) phone, email and notes, then save.",
      "You don't have to add a customer to record a sale — walk-in sales without an account are fine too.",
    ],
  },
  {
    id: "customer-history",
    category: "customers",
    question: "Where do I see a customer's past bookings and sales?",
    answer: ["Open the customer from the Customers list — their page shows a combined history of every booking and sale linked to them, most recent first."],
  },

  // ---- Bookings ----
  {
    id: "add-booking",
    category: "bookings",
    question: "How do I schedule a booking?",
    answer: [
      "Go to Bookings and tap the + button. Pick the customer, service, staff member and time, then save.",
      "Bookings move through statuses — pending, confirmed, completed, cancelled or no-show — which you can update from the booking itself.",
    ],
  },
  {
    id: "booking-email",
    category: "bookings",
    question: "Does a customer get notified about their booking?",
    answer: ["When a booking's status is set to \"confirmed\" and the customer has an email on file, JKTL Business automatically emails them a confirmation with the service, date and time."],
  },

  // ---- Sales & payments ----
  {
    id: "record-sale",
    category: "sales",
    question: "How do I record a sale?",
    answer: [
      "Go to Sales and tap \"New sale\". Pick the customer (or leave it as a walk-in), add each service or product sold, apply a discount if needed, and choose a payment method and status.",
      "The total is calculated for you as you add items.",
    ],
  },
  {
    id: "partial-payment",
    category: "sales",
    question: "A customer only paid part of the bill — what do I do?",
    answer: [
      "Set the sale's payment status to \"Partial\" — a field appears for how much they paid right now, and the app shows the balance still owing.",
      "The sale is saved with that balance outstanding, so nothing forces you to guess or round up.",
    ],
  },
  {
    id: "complete-payment",
    category: "sales",
    question: "How do I record the rest of the payment once a customer pays in full?",
    answer: [
      "Open the sale from the Sales list, then tap \"Update payment\". Enter the new total amount paid — if it covers the full price, the sale automatically flips to \"Paid\".",
      "You can come back and do this as many times as needed until it's settled.",
    ],
  },
  {
    id: "receipt-photo",
    category: "sales",
    question: "Can I attach a photo of the paper receipt?",
    answer: [
      "Yes — it's optional. When recording or updating a sale, there's an \"Add a photo of the receipt\" option. Tap it to take a photo or choose one from your gallery.",
      "It's saved with the sale, so you (or your team) can always pull it up later from the sale's page.",
    ],
  },

  // ---- Invoices ----
  {
    id: "create-invoice",
    category: "invoices",
    question: "How do I create an invoice?",
    answer: ["Go to Invoices and tap the + button. Add the customer, line items and due date. It starts as a draft until you're ready to send it."],
  },
  {
    id: "send-invoice",
    category: "invoices",
    question: "How do I send an invoice to a customer?",
    answer: [
      "Open the invoice and tap \"Email invoice\" to send it straight to the customer's email on file (this needs you to be online and signed in to a real account).",
      "You can also tap \"Print / Download\" to save or print it, or \"Copy summary\" to paste it into WhatsApp or SMS.",
    ],
  },
  {
    id: "mark-invoice-paid",
    category: "invoices",
    question: "How do I mark an invoice as paid?",
    answer: ["Open the invoice and tap \"Mark as paid\". If the customer has an email on file, they automatically get a payment confirmation email."],
  },

  // ---- Products & inventory ----
  {
    id: "add-product",
    category: "stock",
    question: "How do I add a product to sell?",
    answer: ["Go to Products and tap the + button. Set its price, cost, starting stock and a low-stock threshold, so you get warned before you run out."],
  },
  {
    id: "stock-movements",
    category: "stock",
    question: "How does stock get adjusted?",
    answer: [
      "Stock goes down automatically whenever a product is sold in a sale. You can also adjust it manually from Inventory — for new stock arriving, damage, or a stock count correction.",
      "Every change is logged so you can see the full history of a product's stock movements.",
    ],
  },

  // ---- Expenses & reports ----
  {
    id: "add-expense",
    category: "money",
    question: "How do I record an expense?",
    answer: ["Go to Expenses and tap the + button. Choose a category (rent, electricity, staff, supplies, transport, marketing or other), enter the amount and date, and save."],
  },
  {
    id: "reports",
    category: "money",
    question: "What can I see in Reports?",
    answer: [
      "Reports summarize your sales, bookings and top-selling services or products over a date range you choose (today, this week, this month, or a custom range) — useful for spotting trends without doing the maths yourself.",
    ],
  },

  // ---- Team & account ----
  {
    id: "add-team-member",
    category: "team",
    question: "How do I add a staff member?",
    answer: ["Go to Settings → Users and tap \"Add\". They're added as a manager or staff member — only the account owner can be removed as \"owner\"."],
  },
  {
    id: "edit-business-details",
    category: "team",
    question: "How do I change my business name, phone or address?",
    answer: ["Go to Settings → Business and tap \"Edit\". Update any of the details and save — this is what shows on your invoices and confirmation emails."],
  },
  {
    id: "change-password",
    category: "team",
    question: "How do I change my password?",
    answer: ["Go to Settings → Account → Password → \"Change\". You'll need to enter your current password once, then your new one twice to confirm."],
  },
  {
    id: "forgot-password",
    category: "team",
    question: "I forgot my password — how do I get back in?",
    answer: [
      "On the sign-in page, tap \"Forgot password?\", enter the email on your account, and check your inbox — a reset link arrives if that email matches an account, and it works for 1 hour.",
      "Follow the link to choose a new password, then sign in as usual.",
    ],
    keywords: ["reset", "locked out", "recover"],
  },
  {
    id: "profile-photo",
    category: "team",
    question: "How do I add a profile photo?",
    answer: ["Go to Settings → Account and tap the camera icon on your avatar. You can choose a photo from your phone or camera roll."],
  },

  // ---- Working offline ----
  {
    id: "offline-banner",
    category: "offline",
    question: "What does the \"You're offline\" banner mean?",
    answer: [
      "It just means your phone or computer has no internet connection right now. You can keep using the app as normal — every screen still works, and anything you add or change is saved on your device.",
      "As soon as you're back online, a \"Syncing…\" banner appears briefly while those changes are sent up and confirmed.",
    ],
  },
  {
    id: "sync-safety",
    category: "offline",
    question: "Is it safe to make changes while offline?",
    answer: ["Yes — every change is kept in order and applied exactly once when you're back online, even if the connection drops partway through a sync. Nothing is lost or duplicated."],
  },

  // ---- Install (the homescreen guide is rendered by a custom component) ----
  {
    id: "add-to-home-screen",
    category: "install",
    question: "How do I add JKTL Business to my home screen?",
    answer: [
      "Adding JKTL Business to your home screen gives you a proper app icon and lets it open full-screen, without the browser's address bar — it feels just like an installed app.",
    ],
    keywords: ["install", "home screen", "app icon", "pwa", "add to homescreen"],
    custom: "add-to-home-screen",
  },
  {
    id: "push-not-working-iphone",
    category: "install",
    question: "Why aren't push notifications working on my iPhone?",
    answer: [
      "iPhones only support push notifications for a website if it's been added to your home screen first (see \"How do I add JKTL Business to my home screen?\" above) — and you need to open it from that home screen icon, not from a Safari tab, for the notification toggle in Settings to actually work.",
      "You'll also need iOS 16.4 or later. On an older iPhone, the \"Push notifications\" toggle will stay on but nothing will actually arrive — there's no way around this, Apple only added web push support in that version.",
      "If you've done both of those and it's still not asking for permission: open the app from your home screen, go to Settings → Notifications, and turn the push toggle off then on again. If iOS still doesn't show a permission prompt, check your iPhone's own Settings app → JKTL Business → Notifications, and make sure notifications aren't already turned off there.",
    ],
    keywords: ["iphone", "ios", "push", "notification", "not working", "safari"],
  },
];
