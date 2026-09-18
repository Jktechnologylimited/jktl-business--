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
    more: Array<{ href: string; label: string; description: string }>;
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
      { href: "/business/services", label: "Services", description: "Hair, nails, makeup and more" },
      { href: "/business/products", label: "Products", description: "Hair, care and retail stock" },
      { href: "/business/inventory", label: "Inventory", description: "Stock levels and movements" },
      { href: "/business/expenses", label: "Expenses", description: "Rent, power, staff and supplies" },
      { href: "/business/invoices", label: "Invoices", description: "Bills and outstanding payments" },
      { href: "/business/reports", label: "Reports", description: "Sales, bookings and stock" },
      { href: "/business/website", label: "Website", description: "Your public site and online booking" },
      { href: "/business/settings", label: "Settings", description: "Business, team and plan" },
      { href: "/business/help", label: "Help & guides", description: "How-tos and installing the app" },
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

export const BUSINESS_TYPE_OPTIONS: Array<{ id: BusinessType; label: string; hint: string }> = [
  { id: "salon", label: "Hair salon", hint: "Bookings, services, hair and nails" },
  { id: "personal_care", label: "Personal care", hint: "Spa, barber, beauty" },
  { id: "restaurant", label: "Restaurant", hint: "Orders, menu, daily sales" },
  { id: "auto_parts", label: "Auto parts", hint: "Parts, stock, invoices" },
  { id: "building_materials", label: "Building materials", hint: "Cement, rods, wholesale" },
  { id: "plumbing", label: "Pipes & plumbing", hint: "Pipes, fittings, stock" },
  { id: "gas", label: "Gas", hint: "Cylinders, refills, deliveries" },
  { id: "filling_station", label: "Filling station", hint: "Pumps, shifts, daily takings" },
  { id: "wedding_events", label: "Wedding & events", hint: "Events, vendors, invoices" },
  { id: "general", label: "Other business", hint: "Customers, sales and records" },
];

export function getIndustry(type: BusinessType | undefined | null): IndustryConfig {
  return registry[type ?? "general"] ?? registry.general;
}
