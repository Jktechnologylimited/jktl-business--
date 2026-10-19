import { addYears, formatISO } from "date-fns";
import type { AppUser, BusinessProfile, Infrastructure, Organization, OrganizationMember } from "@/lib/types";

export const ORG_ID = "org_glamhair";
export const PROFILE_ID = "biz_glamhair";
export const OWNER_USER_ID = "usr_ada";

export function demoOrganization(now = new Date()): Organization {
  return {
    id: ORG_ID,
    name: "Glam Hair Studio",
    slug: "glamhair",
    createdAt: formatISO(new Date(now.getFullYear(), 1, 12)),
  };
}

export function demoProfile(): BusinessProfile {
  return {
    id: PROFILE_ID,
    organizationId: ORG_ID,
    businessType: "salon",
    displayName: "Glam Hair Studio",
    phone: "0803 441 2291",
    email: "hello@glamhair.jktl.com.ng",
    address: "14 Swali Road, Opolo",
    city: "Yenagoa",
    state: "Bayelsa",
    countryCode: "NG",
    logoUrl: null,
    coverPhotoUrl: null,
    subdomain: "glamhair",
    published: false,
    tagline: "Braids, wash & style, nails — walk-ins welcome.",
    themeColor: "#0f6e5c",
    customDomain: "",
    customDomainVerified: false,
    aboutLong:
      "Glam Hair Studio is a hair and beauty salon in Yenagoa, Bayelsa.\n\nWe have been trading for around 8 years, with a team of three stylists working out of a shop on the main road. Our Google listing carries 212 reviews at an average of 4.8 out of 5.\n\nThis page was built for us by JKTL Business. Booking, enquiries and questions are handled here so nothing gets missed — including when the phone rings and nobody can pick up.",
    galleryUrls: [],
    rating: 4.8,
    reviewCount: 212,
    openingHours: [
      { day: "Monday", hours: "9:00 AM – 7:00 PM" },
      { day: "Tuesday", hours: "9:00 AM – 7:00 PM" },
      { day: "Wednesday", hours: "9:00 AM – 7:00 PM" },
      { day: "Thursday", hours: "9:00 AM – 7:00 PM" },
      { day: "Friday", hours: "9:00 AM – 8:00 PM" },
      { day: "Saturday", hours: "8:00 AM – 8:00 PM" },
    ],
    serviceAreas: ["Yenagoa", "Opolo", "Kpansia", "Amarata"],
    faqs: [
      { question: "How do I book an appointment at Glam Hair Studio?", answer: "Use the booking form on this page and pick a time that suits you. You will get a confirmation straight away, and a reminder before your appointment." },
      { question: "Where are you, and how do I reach you?", answer: "We are at 12 Mbiama-Yenagoa Road, Yenagoa. You can call us on 0803 123 4567." },
      { question: "What are your opening hours?", answer: "We are open Monday to Friday, 9:00 AM – 7:00 PM. We are closed on Sunday." },
    ],
    aboutText:
      "Glam Hair Studio has been Yenagoa's go-to for braids, silk presses and nails since 2019. We use quality products, keep appointments on time, and treat every client like family.",
    instagramUrl: "https://instagram.com/glamhairstudio",
    tiktokUrl: "",
    facebookUrl: "",
    snapchatUrl: "",
    fontPairId: "romantic",
  };
}

export function demoOwner(): AppUser {
  return {
    id: OWNER_USER_ID,
    name: "Ada Briggs",
    email: "ada@glamhair.jktl.com.ng",
    phone: "0803 441 2291",
    avatarUrl: null,
  };
}

export function demoMembers(): OrganizationMember[] {
  return [
    { id: "mem_ada", organizationId: ORG_ID, userId: OWNER_USER_ID, name: "Ada Briggs", email: "ada@glamhair.jktl.com.ng", role: "owner", title: "Owner · Senior Stylist", active: true },
    { id: "mem_tonye", organizationId: ORG_ID, userId: "usr_tonye", name: "Tonye Fiberesima", email: "tonye@glamhair.jktl.com.ng", role: "staff", title: "Stylist", active: true },
    { id: "mem_ibinabo", organizationId: ORG_ID, userId: "usr_ibinabo", name: "Ibinabo Wodi", email: "ibinabo@glamhair.jktl.com.ng", role: "staff", title: "Stylist", active: true },
    { id: "mem_grace", organizationId: ORG_ID, userId: "usr_grace", name: "Grace Okoro", email: "grace@glamhair.jktl.com.ng", role: "manager", title: "Front Desk", active: true },
  ];
}

/** Staff shown in booking/sale assignment — a lighter view than full members. */
export const STAFF = [
  { id: "usr_ada", name: "Ada" },
  { id: "usr_tonye", name: "Tonye" },
  { id: "usr_ibinabo", name: "Ibinabo" },
] as const;

export function demoInfrastructure(now = new Date()): Infrastructure {
  return {
    organizationId: ORG_ID,
    planName: "Website & Hosting — Yearly",
    priceKoboPerYear: 5_000_000,
    priceKoboPerCycle: 5_000_000,
    billingCycle: "yearly",
    // Demo mode shows an already-active subscription so the "Plan" tab and
    // website publishing both demonstrate the paid state without anyone
    // needing a real Paystack checkout just to try the app out.
    subscriptionStatus: "active",
    renewalDate: formatISO(addYears(now, 1), { representation: "date" }),
    storageUsedGb: 0.8,
    storageLimitGb: 2,
    databaseStatus: "active",
    hostingStatus: "active",
    sslStatus: "active",
    entitled: true,
    domain: "glamhair.jktl.com.ng",
  };
}
