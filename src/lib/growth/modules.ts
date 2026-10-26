import type { AdminCapability } from "@/lib/admin-permissions";
export const growthModules: {
  slug: string;
  label: string;
  permission: AdminCapability;
}[] = [
  {
    slug: "content",
    label: "Marketing & campaigns",
    permission: "growth_marketing",
  },
  { slug: "leads", label: "Assigned leads", permission: "growth_leads" },
  {
    slug: "applications",
    label: "Affiliates & Partners",
    permission: "growth_applications",
  },
  { slug: "games", label: "JKTL Games", permission: "growth_games" },
  { slug: "community", label: "Community", permission: "growth_community" },
  { slug: "analytics", label: "Analytics", permission: "growth_analytics" },
  { slug: "resources", label: "Resources", permission: "growth_resources" },
  { slug: "support", label: "Support", permission: "growth_workspace" },
];
