import { subDays } from "date-fns";
import type { InventoryMovement } from "@/lib/types";
import { ORG_ID } from "./business";

function ago(days: number, now: Date): string {
  return subDays(now, days).toISOString();
}

export function demoMovements(now = new Date()): InventoryMovement[] {
  return [
    { id: "mv_1", organizationId: ORG_ID, productId: "prd_bundle", type: "addition", quantity: 6, reason: "Restock from Naija Hair Imports", createdAt: ago(9, now) },
    { id: "mv_2", organizationId: ORG_ID, productId: "prd_closure", type: "sale", quantity: -2, reason: "Sold with installations", createdAt: ago(9, now) },
    { id: "mv_3", organizationId: ORG_ID, productId: "prd_shampoo", type: "addition", quantity: 15, reason: "Restock from Bayelsa Beauty Supplies", createdAt: ago(15, now) },
    { id: "mv_4", organizationId: ORG_ID, productId: "prd_shampoo", type: "sale", quantity: -1, reason: "Sold to walk-in customer", createdAt: ago(0, now) },
    { id: "mv_5", organizationId: ORG_ID, productId: "prd_conditioner", type: "sale", quantity: -1, reason: "Sold to walk-in customer", createdAt: ago(0, now) },
    { id: "mv_6", organizationId: ORG_ID, productId: "prd_edge", type: "sale", quantity: -1, reason: "Sold with braiding", createdAt: ago(0, now) },
    { id: "mv_7", organizationId: ORG_ID, productId: "prd_gelpolish", type: "sale", quantity: -1, reason: "Sold with manicure", createdAt: ago(0, now) },
    { id: "mv_8", organizationId: ORG_ID, productId: "prd_gelpolish", type: "adjustment", quantity: -1, reason: "Stock count correction", createdAt: ago(3, now) },
    { id: "mv_9", organizationId: ORG_ID, productId: "prd_nailart", type: "addition", quantity: 3, reason: "Restock from Port Harcourt Nail Depot", createdAt: ago(18, now) },
    { id: "mv_10", organizationId: ORG_ID, productId: "prd_wigcap", type: "addition", quantity: 20, reason: "Restock from Bayelsa Beauty Supplies", createdAt: ago(12, now) },
  ];
}
