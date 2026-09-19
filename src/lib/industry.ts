import type { BusinessType } from "@/lib/types";

export type NavIcon = "home" | "bookings" | "customers" | "sales" | "more";

export interface IndustryConfig {
  id: BusinessType;
  label: string;
  productName: string;
  tagline: string;
  staffLabel: string;
  staffLabelPlural: string;
  bookingLabel: string;
  bookingLabelPlural: string;
  catalogLabel: string;
  serviceCategories: string[];
  productCategories: string[];
  modules: {
    bookings: boolean;
    services: boolean;
    products: boolean;
    inventory: boolean;
    sales: boolean;
    expenses: boolean;
    invoices: boolean;
    reports: boolean;
  };
  nav: {
    primary: Array<{ href: string; label: string; icon: NavIcon }>;
    /** `group` sorts these into labeled sections on the More page
     * (`src/app/business/more`) instead of one long flat list — sections
     * render in the order their first item appears here, so keep items
     * belonging to the same group next to each other. */
    more: Array<{ href: string; label: string; description: string; group: string }>;
  };
}

const salon: IndustryConfig = {
  id: "salon",
  label: "Hair salon",
  productName: "JKTL Business",
  tagline: "Run your salon from your phone.",
  staffLabel: "Stylist",
  staffLabelPlural: "Stylists",
  bookingLabel: "Booking",
  bookingLabelPlural: "Bookings",
  catalogLabel: "Services",
  serviceCategories: ["Haircut", "Braids", "Install", "Wash & style", "Nails", "Makeup", "Kids"],
  productCategories: ["Hair", "Care", "Nails", "Cosmetics", "Tools"],
  modules: {
    bookings: true,
    services: true,
    products: true,
    inventory: true,
    sales: true,
    expenses: true,
    invoices: true,
    reports: true,
  },
  nav: {
    primary: [
      { href: "/business", label: "Home", icon: "home" },
      { href: "/business/bookings", label: "Bookings", icon: "bookings" },
      { href: "/business/customers", label: "Customers", icon: "customers" },
      { href: "/business/sales", label: "Sales", icon: "sales" },
      { href: "/business/more", label: "More", icon: "more" },
    ],
    more: [
      { href: "/business/services", label: "Services", description: "Hair, nails, makeup and more", group: "Catalogue & stock" },
      { href: "/business/products", label: "Products", description: "Hair, care and retail stock", group: "Catalogue & stock" },
      { href: "/business/inventory", label: "Inventory", description: "Stock levels and movements", group: "Catalogue & stock" },
      { href: "/business/expenses", label: "Expenses", description: "Rent, power, staff and supplies", group: "Money" },
      { href: "/business/invoices", label: "Invoices", description: "Bills and outstanding payments", group: "Money" },
      { href: "/business/reports", label: "Reports", description: "Sales, bookings and stock", group: "Money" },
      { href: "/business/website", label: "Website", description: "Your public site and online booking", group: "Grow your business" },
      { href: "/business/import", label: "Import data", description: "Bring in customers, services and products from a spreadsheet", group: "Grow your business" },
      { href: "/business/settings", label: "Settings", description: "Business, team and plan", group: "Account" },
      { href: "/business/help", label: "Help & guides", description: "How-tos and installing the app", group: "Account" },
    ],
  },
};

/**
 * Later verticals reuse the salon engine with different vocabulary until each
 * gets its own full configuration (categories, dashboard widgets, workflows).
 * This is what keeps it one platform instead of nine codebases.
 */
function stub(id: BusinessType, label: string, bookingLabel: string, catalogLabel = "Catalogue"): IndustryConfig {
  return {
    ...salon,
    id,
    label,
    productName: "JKTL Business",
    tagline: "Manage your business from your phone.",
    bookingLabel,
    bookingLabelPlural: `${bookingLabel}s`,
    staffLabel: "Staff",
    staffLabelPlural: "Staff",
    catalogLabel,
  };
}

const registry: Record<BusinessType, IndustryConfig> = {
  salon,
  // Same salon engine as the other stubs below, for the same reason (see
  // the stub() doc comment) — bookings/services/products all work exactly
  // like a hair salon's until each of these gets its own tailored service
  // and product categories.
  nail_tech: stub("nail_tech", "Nail tech", "Booking", "Services"),
  lash_tech: stub("lash_tech", "Lash tech", "Booking", "Services"),
  nail_lash_studio: stub("nail_lash_studio", "Nail & lash studio", "Booking", "Services"),
  restaurant: stub("restaurant", "Restaurant", "Order", "Menu"),
  auto_parts: stub("auto_parts", "Auto parts", "Order", "Parts"),
  building_materials: stub("building_materials", "Building materials", "Order", "Materials"),
  plumbing: stub("plumbing", "Plumbing materials", "Order", "Materials"),
  personal_care: stub("personal_care", "Personal care", "Booking", "Services"),
  gas: stub("gas", "Gas business", "Order", "Products"),
  filling_station: stub("filling_station", "Filling station", "Shift", "Products"),
  wedding_events: stub("wedding_events", "Wedding & events", "Event", "Packages"),
  general: stub("general", "General business", "Booking", "Catalogue"),
};

export interface BusinessTypeOption {
  id: BusinessType;
  label: string;
  hint: string;
}

export interface BusinessTypeGroup {
  category: string;
  options: BusinessTypeOption[];
}

/** Grouped for the onboarding picker — categories a person scans instead
 * of one flat list of ten-plus options. Order matters here: it's the
 * order groups and options appear in the UI. */
export const BUSINESS_TYPE_GROUPS: BusinessTypeGroup[] = [
  {
    category: "Hair & beauty",
    options: [
      { id: "salon", label: "Hair salon", hint: "Bookings, services, hair and nails" },
      { id: "personal_care", label: "Personal care", hint: "Spa, barber, beauty" },
    ],
  },
  {
    category: "Nails & lashes",
    options: [
      { id: "nail_tech", label: "Nail tech", hint: "Manicure, pedicure, nail art" },
      { id: "lash_tech", label: "Lash tech", hint: "Lash extensions, lifts, tints" },
      { id: "nail_lash_studio", label: "Nail & lash studio", hint: "Both, under one roof" },
    ],
  },
  {
    category: "Food",
    options: [{ id: "restaurant", label: "Restaurant", hint: "Orders, menu, daily sales" }],
  },
  {
    category: "Auto & fuel",
    options: [
      { id: "auto_parts", label: "Auto parts", hint: "Parts, stock, invoices" },
      { id: "gas", label: "Gas", hint: "Cylinders, refills, deliveries" },
      { id: "filling_station", label: "Filling station", hint: "Pumps, shifts, daily takings" },
    ],
  },
  {
    category: "Building & trade",
    options: [
      { id: "building_materials", label: "Building materials", hint: "Cement, rods, wholesale" },
      { id: "plumbing", label: "Pipes & plumbing", hint: "Pipes, fittings, stock" },
    ],
  },
  {
    category: "Events",
    options: [{ id: "wedding_events", label: "Wedding & events", hint: "Events, vendors, invoices" }],
  },
  {
    category: "Other",
    options: [{ id: "general", label: "Other business", hint: "Customers, sales and records" }],
  },
];

/** Flattened view of the groups above, for anywhere that just needs every
 * option in one list (a filter dropdown, say) without the category
 * headers. */
export const BUSINESS_TYPE_OPTIONS: BusinessTypeOption[] = BUSINESS_TYPE_GROUPS.flatMap((g) => g.options);

export function getIndustry(type: BusinessType | undefined | null): IndustryConfig {
  return registry[type ?? "general"] ?? registry.general;
}
