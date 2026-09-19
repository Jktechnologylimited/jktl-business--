import type { Service } from "@/lib/types";
import { ORG_ID } from "./business";

export function demoServices(): Service[] {
  return [
    { id: "svc_haircut", organizationId: ORG_ID, name: "Haircut", category: "Haircut", priceKobo: 250_000, durationMin: 30, description: "Wash, cut and finish.", active: true, imageUrl: null },
    { id: "svc_braiding", organizationId: ORG_ID, name: "Braiding", category: "Braids", priceKobo: 800_000, durationMin: 120, description: "Box braids or cornrows, medium size.", active: true, imageUrl: null },
    { id: "svc_install", organizationId: ORG_ID, name: "Hair Installation", category: "Install", priceKobo: 2_500_000, durationMin: 150, description: "Closure or frontal install, customer's hair.", active: true, imageUrl: null },
    { id: "svc_wash", organizationId: ORG_ID, name: "Wash & Blow-dry", category: "Wash & style", priceKobo: 300_000, durationMin: 45, description: "Shampoo, deep condition, blow-dry.", active: true, imageUrl: null },
    { id: "svc_style", organizationId: ORG_ID, name: "Silk Press", category: "Wash & style", priceKobo: 600_000, durationMin: 60, description: "Silk press with heat protectant.", active: true, imageUrl: null },
    { id: "svc_manicure", organizationId: ORG_ID, name: "Gel Manicure", category: "Nails", priceKobo: 400_000, durationMin: 45, description: "Shape, cuticle care, gel polish.", active: true, imageUrl: null },
    { id: "svc_pedicure", organizationId: ORG_ID, name: "Pedicure", category: "Nails", priceKobo: 450_000, durationMin: 50, description: "Soak, scrub, polish.", active: true, imageUrl: null },
    { id: "svc_makeup", organizationId: ORG_ID, name: "Makeup", category: "Makeup", priceKobo: 1_500_000, durationMin: 60, description: "Full face, event-ready.", active: true, imageUrl: null },
    { id: "svc_kids", organizationId: ORG_ID, name: "Kids Braiding", category: "Kids", priceKobo: 500_000, durationMin: 90, description: "Simple cornrows or twists for children.", active: true, imageUrl: null },
  ];
}
