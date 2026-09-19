import type { Product } from "@/lib/types";
import { ORG_ID } from "./business";

export function demoProducts(): Product[] {
  return [
    { id: "prd_bundle", organizationId: ORG_ID, name: "Brazilian Hair Bundle", sku: "HR-BUN-100", category: "Hair", costKobo: 1_800_000, priceKobo: 2_500_000, stockQty: 6, lowStockThreshold: 3, supplier: "Naija Hair Imports", active: true, imageUrl: null },
    { id: "prd_closure", organizationId: ORG_ID, name: "Human Hair Closure", sku: "HR-CLO-004", category: "Hair", costKobo: 1_200_000, priceKobo: 1_600_000, stockQty: 2, lowStockThreshold: 3, supplier: "Naija Hair Imports", active: true, imageUrl: null },
    { id: "prd_shampoo", organizationId: ORG_ID, name: "Sulfate-Free Shampoo 500ml", sku: "CR-SHM-500", category: "Care", costKobo: 180_000, priceKobo: 280_000, stockQty: 20, lowStockThreshold: 5, supplier: "Bayelsa Beauty Supplies", active: true, imageUrl: null },
    { id: "prd_conditioner", organizationId: ORG_ID, name: "Deep Repair Conditioner", sku: "CR-CON-500", category: "Care", costKobo: 190_000, priceKobo: 290_000, stockQty: 18, lowStockThreshold: 5, supplier: "Bayelsa Beauty Supplies", active: true, imageUrl: null },
    { id: "prd_cream", organizationId: ORG_ID, name: "Ultra Sheen Hair Cream", sku: "CR-CRM-200", category: "Care", costKobo: 90_000, priceKobo: 150_000, stockQty: 30, lowStockThreshold: 8, supplier: "Bayelsa Beauty Supplies", active: true, imageUrl: null },
    { id: "prd_edge", organizationId: ORG_ID, name: "Edge Control", sku: "CR-EDG-100", category: "Care", costKobo: 70_000, priceKobo: 130_000, stockQty: 25, lowStockThreshold: 6, supplier: "Bayelsa Beauty Supplies", active: true, imageUrl: null },
    { id: "prd_gelpolish", organizationId: ORG_ID, name: "Gel Nail Polish", sku: "NL-GEL-014", category: "Nails", costKobo: 80_000, priceKobo: 180_000, stockQty: 4, lowStockThreshold: 5, supplier: "Port Harcourt Nail Depot", active: true, imageUrl: null },
    { id: "prd_nailart", organizationId: ORG_ID, name: "Nail Art Set", sku: "NL-ART-007", category: "Nails", costKobo: 250_000, priceKobo: 450_000, stockQty: 5, lowStockThreshold: 2, supplier: "Port Harcourt Nail Depot", active: true, imageUrl: null },
    { id: "prd_foundation", organizationId: ORG_ID, name: "Makeup Foundation", sku: "CS-FND-030", category: "Cosmetics", costKobo: 350_000, priceKobo: 600_000, stockQty: 8, lowStockThreshold: 3, supplier: "Glow Cosmetics NG", active: true, imageUrl: null },
    { id: "prd_wigcap", organizationId: ORG_ID, name: "Wig Cap", sku: "TL-CAP-002", category: "Tools", costKobo: 20_000, priceKobo: 50_000, stockQty: 40, lowStockThreshold: 10, supplier: "Bayelsa Beauty Supplies", active: true, imageUrl: null },
  ];
}
