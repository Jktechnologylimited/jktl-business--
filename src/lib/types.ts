export type BusinessType =
  | "salon"
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
  subdomain: string;
  published: boolean;
  tagline: string;
  themeColor: string;
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
  bookings: Booking[];
  sales: Sale[];
  saleItems: SaleItem[];
  expenses: Expense[];
  invoices: Invoice[];
  invoiceItems: InvoiceItem[];
  movements: InventoryMovement[];
  infrastructure: Infrastructure;
}
