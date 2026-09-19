import type { TenantData } from "@/lib/types";
import { demoInfrastructure, demoMembers, demoOrganization, demoOwner, demoProfile } from "./business";
import { demoCustomers } from "./customers";
import { demoServices } from "./services";
import { demoProducts } from "./products";
import { demoTestimonials } from "./testimonials";
import { demoBookings } from "./bookings";
import { demoSales, demoSaleItems } from "./sales";
import { demoExpenses } from "./expenses";
import { demoInvoices, demoInvoiceItems } from "./invoices";
import { demoMovements } from "./inventory";

export { ORG_ID, PROFILE_ID, OWNER_USER_ID, STAFF } from "./business";

/**
 * Build a full demo tenant, anchored to `now` so "today's bookings" and
 * "today's sales" always land on the day the app is actually opened. This is
 * the one place that assembles mock data — pages read through selectors.ts,
 * never these arrays directly, so swapping in real queries later touches
 * this file and selectors.ts, not the UI.
 */
export function buildTenantData(now = new Date()): TenantData {
  return {
    organization: demoOrganization(now),
    profile: demoProfile(),
    user: demoOwner(),
    members: demoMembers(),
    customers: demoCustomers(now),
    services: demoServices(),
    products: demoProducts(),
    testimonials: demoTestimonials(now),
    bookings: demoBookings(now),
    sales: demoSales(now),
    saleItems: demoSaleItems(),
    expenses: demoExpenses(now),
    invoices: demoInvoices(now),
    invoiceItems: demoInvoiceItems(),
    movements: demoMovements(now),
    infrastructure: demoInfrastructure(now),
  };
}
