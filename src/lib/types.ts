export type BusinessType =
  | "salon"
  | "nail_tech"
  | "lash_tech"
  | "nail_lash_studio"
  | "restaurant"
  | "auto_parts"
  | "building_materials"
  | "plumbing"
  | "personal_care"
  | "gas"
  | "filling_station"
  | "wedding_events"
  | "general";

export type MemberRole = "owner" | "manager" | "staff";
export type Gender = "female" | "male" | "other" | "";

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
export type PaymentMethod = "cash" | "transfer" | "pos" | "other";
export type PaymentStatus = "paid" | "pending" | "partial";
export type InvoiceStatus = "draft" | "pending" | "paid" | "overdue";
export type ExpenseCategory =
  | "rent"
  | "electricity"
  | "staff"
  | "supplies"
  | "transportation"
  | "marketing"
  | "other";
export type MovementType = "addition" | "deduction" | "sale" | "adjustment";
export type LineKind = "service" | "product";

/** Integer kobo (1 Naira = 100 kobo). Never store money as a float. */
export type Kobo = number;

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface BusinessProfile {
  id: string;
  organizationId: string;
  businessType: BusinessType;
  displayName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  logoUrl: string | null;
  /** A wide banner photo for the site's hero section. Null shows a plain
   * brand-color hero instead — the site still looks intentional without
   * one, just plainer. */
  coverPhotoUrl: string | null;
  subdomain: string;
  published: boolean;
  tagline: string;
  themeColor: string;
  /** A business's own domain (e.g. "www.glamhairstudio.com"), mapped onto
   * their site instead of / in addition to their *.jktl.com.ng subdomain.
   * Empty string when none is set. Requires an active subscription to set
   * up — see `startCustomDomainVerificationAction`. */
  customDomain: string;
  /** True once ownership has been proven via the DNS TXT record — until
   * then, `customDomain` is just a pending, unverified request and
   * middleware won't route traffic for it. */
  customDomainVerified: boolean;
  /** A longer free-text description shown in the site's "About" section.
   * Empty string shows nothing — the section just doesn't render. */
  aboutText: string;
  instagramUrl: string;
  tiktokUrl: string;
  facebookUrl: string;
  snapchatUrl: string;
  /** One of the ids in `src/lib/site-fonts.ts` — a display+body Google Font
   * pairing for the public website, chosen independently of `themeColor`. */
  fontPairId: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  email: string;
  role: MemberRole;
  title: string;
  active: boolean;
}

export interface Customer {
  id: string;
  organizationId: string;
  name: string;
  phone: string;
  email: string;
  gender: Gender;
  notes: string;
  createdAt: string;
}

export interface Service {
  id: string;
  organizationId: string;
  name: string;
  category: string;
  priceKobo: Kobo;
  durationMin: number;
  description: string;
  active: boolean;
  /** Shown on the public website's services section. Null falls back to a
   * plain card with no photo — same optional-photo pattern as `Product`. */
  imageUrl: string | null;
}

export interface Product {
  id: string;
  organizationId: string;
  name: string;
  sku: string;
  category: string;
  costKobo: Kobo;
  priceKobo: Kobo;
  stockQty: number;
  lowStockThreshold: number;
  supplier: string;
  active: boolean;
  /** Shown on the public website's product catalog. Null falls back to a
   * generic product icon there — a photo is optional, not required. */
  imageUrl: string | null;
}

export interface Booking {
  id: string;
  organizationId: string;
  customerId: string;
  serviceId: string;
  staffId: string;
  startsAt: string;
  status: BookingStatus;
  notes: string;
  priceKobo: Kobo;
}

export interface Sale {
  id: string;
  organizationId: string;
  customerId: string | null;
  subtotalKobo: Kobo;
  discountKobo: Kobo;
  totalKobo: Kobo;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  amountPaidKobo: Kobo;
  receiptPhotoUrl: string | null;
  notes: string;
  createdAt: string;
}

export interface SaleItem {
  id: string;
  organizationId: string;
  saleId: string;
  kind: LineKind;
  refId: string;
  name: string;
  quantity: number;
  unitPriceKobo: Kobo;
  totalKobo: Kobo;
}

export interface Expense {
  id: string;
  organizationId: string;
  description: string;
  category: ExpenseCategory;
  amountKobo: Kobo;
  paymentMethod: PaymentMethod;
  date: string;
  notes: string;
}

export interface Invoice {
  id: string;
  organizationId: string;
  number: string;
  customerId: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  subtotalKobo: Kobo;
  discountKobo: Kobo;
  totalKobo: Kobo;
  notes: string;
  paidAt: string | null;
  /** "online" once paid through the public payment link (Paystack split
   * payment), "manual" for the existing owner-toggled "Mark as paid" — the
   * default for every invoice until it's actually paid one way or the
   * other. */
  paidVia: "manual" | "online";
  /** JKTL's ₦50 cut, only ever non-zero on an "online" paid invoice — the
   * payer's surcharge, not deducted from the business's own total above. */
  platformFeeKobo: Kobo;
  /** Paystack's transaction reference, only set once paid online. */
  paymentReference: string;
}

export interface InvoiceItem {
  id: string;
  organizationId: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPriceKobo: Kobo;
  totalKobo: Kobo;
}

/** Owner-entered customer testimonial shown on the public website. Not a
 * public submission form — see CHECKPOINT.md for why (no moderation queue
 * needed with this trust model). */
export interface Testimonial {
  id: string;
  organizationId: string;
  customerName: string;
  quote: string;
  /** 1-5, or null if the owner didn't set one. */
  rating: number | null;
  createdAt: string;
}

export interface InventoryMovement {
  id: string;
  organizationId: string;
  productId: string;
  type: MovementType;
  quantity: number;
  reason: string;
  createdAt: string;
}

export interface Infrastructure {
  organizationId: string;
  planName: string;
  priceKoboPerYear: Kobo;
  /** The amount actually charged per billing cycle (see `billingCycle`) —
   * `priceKoboPerYear` above is kept as an annualized reference figure for
   * the renewal-reminder email and any "per year" display. */
  priceKoboPerCycle: Kobo;
  billingCycle: "monthly" | "quarterly" | "biannually" | "yearly";
  /** Whether the "Website & Hosting" add-on is currently paid for. Nothing
   * in JKTL Business actually checks this yet — publishing a website on a
   * *.jktl.com.ng subdomain is free, since it costs nothing extra per
   * business. This is tracked for whenever a real paid add-on (a custom
   * domain, storage past a free quota) needs to check it. */
  subscriptionStatus: "inactive" | "active" | "past_due" | "canceled";
  renewalDate: string;
  storageUsedGb: number;
  storageLimitGb: number;
  databaseStatus: "active" | "provisioning" | "paused";
  hostingStatus: "active" | "pending";
  sslStatus: "active" | "pending";
  domain: string;
}

export interface TenantData {
  organization: Organization;
  profile: BusinessProfile;
  user: AppUser;
  members: OrganizationMember[];
  customers: Customer[];
  services: Service[];
  products: Product[];
  testimonials: Testimonial[];
  bookings: Booking[];
  sales: Sale[];
  saleItems: SaleItem[];
  expenses: Expense[];
  invoices: Invoice[];
  invoiceItems: InvoiceItem[];
  movements: InventoryMovement[];
  infrastructure: Infrastructure;
}
