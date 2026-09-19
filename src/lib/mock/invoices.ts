import { addDays, subDays } from "date-fns";
import type { Invoice, InvoiceItem } from "@/lib/types";
import { ORG_ID } from "./business";

function daysAgo(days: number, now: Date): string {
  return subDays(now, days).toISOString().slice(0, 10);
}
function daysFromNow(days: number, now: Date): string {
  return addDays(now, days).toISOString().slice(0, 10);
}

export function demoInvoices(now = new Date()): Invoice[] {
  return [
    {
      id: "inv_1",
      organizationId: ORG_ID,
      number: "INV-0001",
      customerId: "cus_ivie",
      status: "paid",
      issueDate: daysAgo(20, now),
      dueDate: daysAgo(13, now),
      subtotalKobo: 2_500_000,
      discountKobo: 100_000,
      totalKobo: 2_400_000,
      notes: "Full sew-in install, deposit already received.",
      paidAt: subDays(now, 15).toISOString(),
      paidVia: "manual",
      platformFeeKobo: 0,
      paymentReference: "",
    },
    {
      id: "inv_2",
      organizationId: ORG_ID,
      number: "INV-0002",
      customerId: "cus_blessing",
      status: "pending",
      issueDate: daysAgo(5, now),
      dueDate: daysFromNow(5, now),
      subtotalKobo: 2_500_000,
      discountKobo: 0,
      totalKobo: 2_500_000,
      notes: "Hair installation, balance due on collection.",
      paidAt: null,
      paidVia: "manual",
      platformFeeKobo: 0,
      paymentReference: "",
    },
    {
      id: "inv_3",
      organizationId: ORG_ID,
      number: "INV-0003",
      customerId: "cus_naomi",
      status: "overdue",
      issueDate: daysAgo(20, now),
      dueDate: daysAgo(6, now),
      subtotalKobo: 1_700_000,
      discountKobo: 0,
      totalKobo: 1_700_000,
      notes: "Makeup and styling for a family event.",
      paidAt: null,
      paidVia: "manual",
      platformFeeKobo: 0,
      paymentReference: "",
    },
    {
      id: "inv_4",
      organizationId: ORG_ID,
      number: "INV-0004",
      customerId: "cus_chidinma",
      status: "paid",
      issueDate: daysAgo(7, now),
      dueDate: daysAgo(3, now),
      subtotalKobo: 600_000,
      discountKobo: 0,
      totalKobo: 600_000,
      notes: "",
      paidAt: subDays(now, 6).toISOString(),
      paidVia: "manual",
      platformFeeKobo: 0,
      paymentReference: "",
    },
    {
      id: "inv_5",
      organizationId: ORG_ID,
      number: "INV-0005",
      customerId: "cus_joy",
      status: "draft",
      issueDate: daysAgo(0, now),
      dueDate: daysFromNow(7, now),
      subtotalKobo: 300_000,
      discountKobo: 0,
      totalKobo: 300_000,
      notes: "Not yet sent to customer.",
      paidAt: null,
      paidVia: "manual",
      platformFeeKobo: 0,
      paymentReference: "",
    },
  ];
}

export function demoInvoiceItems(): InvoiceItem[] {
  return [
    { id: "ii_1", organizationId: ORG_ID, invoiceId: "inv_1", description: "Hair Installation", quantity: 1, unitPriceKobo: 2_500_000, totalKobo: 2_500_000 },
    { id: "ii_2", organizationId: ORG_ID, invoiceId: "inv_2", description: "Hair Installation", quantity: 1, unitPriceKobo: 2_500_000, totalKobo: 2_500_000 },
    { id: "ii_3", organizationId: ORG_ID, invoiceId: "inv_3", description: "Makeup", quantity: 1, unitPriceKobo: 1_500_000, totalKobo: 1_500_000 },
    { id: "ii_3b", organizationId: ORG_ID, invoiceId: "inv_3", description: "Silk Press", quantity: 1, unitPriceKobo: 200_000, totalKobo: 200_000 },
    { id: "ii_4", organizationId: ORG_ID, invoiceId: "inv_4", description: "Silk Press", quantity: 1, unitPriceKobo: 600_000, totalKobo: 600_000 },
    { id: "ii_5", organizationId: ORG_ID, invoiceId: "inv_5", description: "Wash & Blow-dry", quantity: 1, unitPriceKobo: 300_000, totalKobo: 300_000 },
  ];
}
