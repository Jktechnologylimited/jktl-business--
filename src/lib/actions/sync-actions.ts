"use server";

import { requireSession } from "@/lib/session";
import { listCustomers } from "@/lib/db/customers";
import { listServices } from "@/lib/db/services";
import { listProducts } from "@/lib/db/products";
import { listBookings } from "@/lib/db/bookings";
import { listSales, listSaleItems } from "@/lib/db/sales";
import { listExpenses } from "@/lib/db/expenses";
import { listInvoices, listInvoiceItems } from "@/lib/db/invoices";
import { listMovements } from "@/lib/db/inventory";
import { listMembers } from "@/lib/db/members";
import { getBusinessProfile, getInfrastructure, getOrganization, getUser } from "@/lib/db/organizations";
import type { ActionResult } from "./types";
import type { TenantData } from "@/lib/types";

/** Pulls everything for the signed-in org in one round of parallel queries —
 * the "live" equivalent of the mock layer's buildTenantData(). Used on
 * first load and whenever the app comes back online. */
export async function pullAllAction(): Promise<ActionResult<TenantData>> {
  try {
    const { userId, organizationId } = await requireSession();

    const [organization, profile, user, infrastructure, members, customers, services, products, bookings, sales, saleItems, expenses, invoices, invoiceItems, movements] =
      await Promise.all([
        getOrganization(organizationId),
        getBusinessProfile(organizationId),
        getUser(userId),
        getInfrastructure(organizationId),
        listMembers(organizationId),
        listCustomers(organizationId),
        listServices(organizationId),
        listProducts(organizationId),
        listBookings(organizationId),
        listSales(organizationId),
        listSaleItems(organizationId),
        listExpenses(organizationId),
        listInvoices(organizationId),
        listInvoiceItems(organizationId),
        listMovements(organizationId),
      ]);

    if (!organization || !profile || !user || !infrastructure) {
      return { ok: false, error: "Account not found." };
    }

    return {
      ok: true,
      data: { organization, profile, user, members, customers, services, products, bookings, sales, saleItems, expenses, invoices, invoiceItems, movements, infrastructure },
    };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't load your data." };
  }
}
