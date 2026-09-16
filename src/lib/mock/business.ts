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
    logoUrl: null,
    subdomain: "glamhair",
  };
}

export function demoOwner(): AppUser {
  return {
    id: OWNER_USER_ID,
    name: "Ada Briggs",
    email: "ada@glamhair.jktl.com.ng",
    phone: "0803 441 2291",
  };
}

export function demoMembers(): OrganizationMember[] {
  return [
    { id: "mem_ada", organizationId: ORG_ID, userId: OWNER_USER_ID, role: "owner", title: "Owner · Senior Stylist", active: true },
    { id: "mem_tonye", organizationId: ORG_ID, userId: "usr_tonye", role: "staff", title: "Stylist", active: true },
    { id: "mem_ibinabo", organizationId: ORG_ID, userId: "usr_ibinabo", role: "staff", title: "Stylist", active: true },
    { id: "mem_grace", organizationId: ORG_ID, userId: "usr_grace", role: "manager", title: "Front Desk", active: true },
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
    planName: "Business Starter",
    priceKoboPerYear: 5_000_000,
    renewalDate: formatISO(addYears(now, 1), { representation: "date" }),
    storageUsedGb: 0.8,
    storageLimitGb: 2,
    databaseStatus: "active",
    hostingStatus: "active",
    sslStatus: "active",
    domain: "glamhair.jktl.com.ng",
  };
}
