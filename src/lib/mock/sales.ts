import { setHours, setMinutes, startOfDay, subDays } from "date-fns";
import type { Sale, SaleItem } from "@/lib/types";
import { ORG_ID } from "./business";

function at(now: Date, daysAgo: number, hour: number, minute: number): string {
  return setMinutes(setHours(startOfDay(subDays(now, daysAgo)), hour), minute).toISOString();
}

export function demoSales(now = new Date()): Sale[] {
  return [
    // Today
    { id: "sl_1", organizationId: ORG_ID, customerId: "cus_faith", subtotalKobo: 250_000, discountKobo: 0, totalKobo: 250_000, paymentMethod: "cash", paymentStatus: "paid", notes: "", createdAt: at(now, 0, 8, 55) },
    { id: "sl_2", organizationId: ORG_ID, customerId: "cus_preye", subtotalKobo: 930_000, discountKobo: 0, totalKobo: 930_000, paymentMethod: "transfer", paymentStatus: "paid", notes: "", createdAt: at(now, 0, 11, 5) },
    { id: "sl_3", organizationId: ORG_ID, customerId: "cus_ruth", subtotalKobo: 580_000, discountKobo: 0, totalKobo: 580_000, paymentMethod: "pos", paymentStatus: "paid", notes: "", createdAt: at(now, 0, 10, 15) },
    { id: "sl_4", organizationId: ORG_ID, customerId: "cus_comfort", subtotalKobo: 750_000, discountKobo: 0, totalKobo: 750_000, paymentMethod: "cash", paymentStatus: "paid", notes: "Mother and daughter.", createdAt: at(now, 0, 11, 30) },
    { id: "sl_5", organizationId: ORG_ID, customerId: "cus_grace", subtotalKobo: 450_000, discountKobo: 0, totalKobo: 450_000, paymentMethod: "transfer", paymentStatus: "paid", notes: "", createdAt: at(now, 0, 11, 45) },
    { id: "sl_6", organizationId: ORG_ID, customerId: "cus_ebiere", subtotalKobo: 570_000, discountKobo: 0, totalKobo: 570_000, paymentMethod: "pos", paymentStatus: "paid", notes: "Walk-in, products only.", createdAt: at(now, 0, 13, 40) },
    { id: "sl_7", organizationId: ORG_ID, customerId: "cus_doris", subtotalKobo: 300_000, discountKobo: 30_000, totalKobo: 270_000, paymentMethod: "cash", paymentStatus: "paid", notes: "Loyalty discount.", createdAt: at(now, 0, 12, 10) },

    // Prior days — for reports and recent activity
    { id: "sl_8", organizationId: ORG_ID, customerId: "cus_miebi", subtotalKobo: 250_000, discountKobo: 0, totalKobo: 250_000, paymentMethod: "cash", paymentStatus: "paid", notes: "", createdAt: at(now, 1, 9, 30) },
    { id: "sl_9", organizationId: ORG_ID, customerId: "cus_blessing", subtotalKobo: 800_000, discountKobo: 0, totalKobo: 800_000, paymentMethod: "transfer", paymentStatus: "paid", notes: "", createdAt: at(now, 1, 14, 0) },
    { id: "sl_10", organizationId: ORG_ID, customerId: "cus_ivie", subtotalKobo: 2_500_000, discountKobo: 100_000, totalKobo: 2_400_000, paymentMethod: "transfer", paymentStatus: "paid", notes: "Full sew-in install.", createdAt: at(now, 3, 12, 0) },
    { id: "sl_11", organizationId: ORG_ID, customerId: "cus_joy", subtotalKobo: 300_000, discountKobo: 0, totalKobo: 300_000, paymentMethod: "cash", paymentStatus: "paid", notes: "", createdAt: at(now, 4, 10, 45) },
    { id: "sl_12", organizationId: ORG_ID, customerId: "cus_patience", subtotalKobo: 450_000, discountKobo: 0, totalKobo: 450_000, paymentMethod: "pos", paymentStatus: "paid", notes: "", createdAt: at(now, 5, 16, 0) },
    { id: "sl_13", organizationId: ORG_ID, customerId: "cus_chidinma", subtotalKobo: 600_000, discountKobo: 0, totalKobo: 600_000, paymentMethod: "cash", paymentStatus: "partial", notes: "Balance of ₦2,000 outstanding.", createdAt: at(now, 6, 13, 20) },
    { id: "sl_14", organizationId: ORG_ID, customerId: "cus_naomi", subtotalKobo: 180_000, discountKobo: 0, totalKobo: 180_000, paymentMethod: "transfer", paymentStatus: "paid", notes: "", createdAt: at(now, 9, 11, 0) },
    { id: "sl_15", organizationId: ORG_ID, customerId: null, subtotalKobo: 130_000, discountKobo: 0, totalKobo: 130_000, paymentMethod: "cash", paymentStatus: "paid", notes: "Walk-in, no account.", createdAt: at(now, 12, 15, 30) },
  ];
}

export function demoSaleItems(): SaleItem[] {
  return [
    { id: "si_1a", organizationId: ORG_ID, saleId: "sl_1", kind: "service", refId: "svc_haircut", name: "Haircut", quantity: 1, unitPriceKobo: 250_000, totalKobo: 250_000 },

    { id: "si_2a", organizationId: ORG_ID, saleId: "sl_2", kind: "service", refId: "svc_braiding", name: "Braiding", quantity: 1, unitPriceKobo: 800_000, totalKobo: 800_000 },
    { id: "si_2b", organizationId: ORG_ID, saleId: "sl_2", kind: "product", refId: "prd_edge", name: "Edge Control", quantity: 1, unitPriceKobo: 130_000, totalKobo: 130_000 },

    { id: "si_3a", organizationId: ORG_ID, saleId: "sl_3", kind: "service", refId: "svc_manicure", name: "Gel Manicure", quantity: 1, unitPriceKobo: 400_000, totalKobo: 400_000 },
    { id: "si_3b", organizationId: ORG_ID, saleId: "sl_3", kind: "product", refId: "prd_gelpolish", name: "Gel Nail Polish", quantity: 1, unitPriceKobo: 180_000, totalKobo: 180_000 },

    { id: "si_4a", organizationId: ORG_ID, saleId: "sl_4", kind: "service", refId: "svc_kids", name: "Kids Braiding", quantity: 1, unitPriceKobo: 500_000, totalKobo: 500_000 },
    { id: "si_4b", organizationId: ORG_ID, saleId: "sl_4", kind: "service", refId: "svc_haircut", name: "Haircut", quantity: 1, unitPriceKobo: 250_000, totalKobo: 250_000 },

    { id: "si_5a", organizationId: ORG_ID, saleId: "sl_5", kind: "service", refId: "svc_pedicure", name: "Pedicure", quantity: 1, unitPriceKobo: 450_000, totalKobo: 450_000 },

    { id: "si_6a", organizationId: ORG_ID, saleId: "sl_6", kind: "product", refId: "prd_shampoo", name: "Sulfate-Free Shampoo 500ml", quantity: 1, unitPriceKobo: 280_000, totalKobo: 280_000 },
    { id: "si_6b", organizationId: ORG_ID, saleId: "sl_6", kind: "product", refId: "prd_conditioner", name: "Deep Repair Conditioner", quantity: 1, unitPriceKobo: 290_000, totalKobo: 290_000 },

    { id: "si_7a", organizationId: ORG_ID, saleId: "sl_7", kind: "service", refId: "svc_wash", name: "Wash & Blow-dry", quantity: 1, unitPriceKobo: 300_000, totalKobo: 300_000 },
  ];
}
