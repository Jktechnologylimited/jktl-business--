import { subDays } from "date-fns";
import type { Expense } from "@/lib/types";
import { ORG_ID } from "./business";

function ago(days: number, now: Date): string {
  return subDays(now, days).toISOString();
}

export function demoExpenses(now = new Date()): Expense[] {
  return [
    { id: "ex_1", organizationId: ORG_ID, description: "Shop rent — September", category: "rent", amountKobo: 15_000_000, paymentMethod: "transfer", date: ago(4, now), notes: "" },
    { id: "ex_2", organizationId: ORG_ID, description: "NEPA token", category: "electricity", amountKobo: 800_000, paymentMethod: "cash", date: ago(2, now), notes: "Prepaid meter." },
    { id: "ex_3", organizationId: ORG_ID, description: "Stylist wages — Tonye", category: "staff", amountKobo: 6_000_000, paymentMethod: "transfer", date: ago(6, now), notes: "" },
    { id: "ex_4", organizationId: ORG_ID, description: "Stylist wages — Ibinabo", category: "staff", amountKobo: 6_000_000, paymentMethod: "transfer", date: ago(6, now), notes: "" },
    { id: "ex_5", organizationId: ORG_ID, description: "Hair bundles restock", category: "supplies", amountKobo: 9_000_000, paymentMethod: "transfer", date: ago(9, now), notes: "6 bundles from Naija Hair Imports." },
    { id: "ex_6", organizationId: ORG_ID, description: "Generator fuel", category: "transportation", amountKobo: 700_000, paymentMethod: "cash", date: ago(3, now), notes: "" },
    { id: "ex_7", organizationId: ORG_ID, description: "Instagram promo post", category: "marketing", amountKobo: 500_000, paymentMethod: "transfer", date: ago(11, now), notes: "Boosted post for bridal packages." },
    { id: "ex_8", organizationId: ORG_ID, description: "Shampoo & conditioner restock", category: "supplies", amountKobo: 3_200_000, paymentMethod: "pos", date: ago(15, now), notes: "" },
    { id: "ex_9", organizationId: ORG_ID, description: "Waste disposal", category: "other", amountKobo: 200_000, paymentMethod: "cash", date: ago(20, now), notes: "" },
    { id: "ex_10", organizationId: ORG_ID, description: "Salon signage repaint", category: "other", amountKobo: 1_200_000, paymentMethod: "cash", date: ago(28, now), notes: "" },
  ];
}
