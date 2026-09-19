import type { Testimonial } from "@/lib/types";
import { ORG_ID } from "./business";

export function demoTestimonials(now = new Date()): Testimonial[] {
  return [
    {
      id: "tst_blessing",
      organizationId: ORG_ID,
      customerName: "Blessing O.",
      quote: "Best silk press I've had in Yenagoa — lasted almost two weeks and my hair felt so healthy after.",
      rating: 5,
      createdAt: now.toISOString(),
    },
    {
      id: "tst_faith",
      organizationId: ORG_ID,
      customerName: "Faith A.",
      quote: "Booked online, showed up, was seated in 5 minutes. The braids were neat and they didn't rush.",
      rating: 5,
      createdAt: now.toISOString(),
    },
    {
      id: "tst_grace",
      organizationId: ORG_ID,
      customerName: "Grace N.",
      quote: "My go-to for nails now. Clean space, friendly staff, reasonable prices.",
      rating: 4,
      createdAt: now.toISOString(),
    },
  ];
}
