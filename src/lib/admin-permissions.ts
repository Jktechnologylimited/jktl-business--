/**
 * What an admin account may do.
 *
 * Pure and dependency-free, so the rules that decide who can move money and who
 * cannot are unit tested rather than scattered across `if` statements in twenty
 * files. Every route and every server action asks this module, so there is one
 * answer to "may this person do that" instead of one per screen.
 *
 * Roles separate customer assistance, content, partner operations and ownership:
 *
 *   owner              — everything, including creating admins and running the
 *                        money job.
 *   affiliate_manager  — the partner side: approve, decline, payouts, and the
 *                        reports that let them do it without asking.
 *   analyst            — read-only insight. No state-changing action anywhere.
 *
 * Roles rather than customer-configurable permission flags: a permission
 * matrix nobody maintains is worse than a role that is occasionally too coarse.
 */

export type AdminRole =
  "owner" | "affiliate_manager" | "analyst" | "editor" | "support";

/** A capability, not a page. Pages are composed from these. */
export type AdminCapability =
  | "manage_support"
  | "publish_reviews"
  | "manage_email"
  | "manage_features"
  | "manage_custom"
  | "manage_domains"
  | "manage_content"
  | "view_businesses"
  | "send_broadcasts"
  | "manage_affiliates"
  | "record_payouts"
  | "run_lead_engine"
  | "import_leads"
  | "view_insights"
  | "manage_team"
  | "run_daily_job";

const MATRIX: Record<AdminRole, AdminCapability[]> = {
  support: ["manage_support"],
  owner: [
    "manage_support",
    "publish_reviews",
    "manage_email",
    "manage_features",
    "manage_custom",
    "manage_domains",
    "manage_content",
    "view_businesses",
    "send_broadcasts",
    "manage_affiliates",
    "record_payouts",
    "run_lead_engine",
    "import_leads",
    "view_insights",
    "manage_team",
    "run_daily_job",
  ],
  editor: ["manage_content", "manage_features", "publish_reviews"],
  affiliate_manager: [
    // The point of the role: approve partners, pay them, and see the numbers
    // needed to do both without asking the owner.
    "manage_affiliates",
    "record_payouts",
    "view_insights",
  ],
  analyst: [
    // Read-only, deliberately. An "analyst" who can approve a payout is a
    // mislabelled owner.
    "view_insights",
  ],
};

export function can(role: AdminRole, capability: AdminCapability): boolean {
  return MATRIX[role]?.includes(capability) ?? false;
}

/** Unknown roles get nothing. A role typo in the database must fail closed. */
export function normaliseRole(role: string | null | undefined): AdminRole {
  return role === "owner" ||
    role === "affiliate_manager" ||
    role === "analyst" ||
    role === "editor" ||
    role === "support"
    ? role
    : "analyst";
}

export const ROLE_LABEL: Record<AdminRole, string> = {
  support: "Support",
  owner: "Owner",
  editor: "Editor",
  affiliate_manager: "Affiliate manager",
  analyst: "Analyst (read-only)",
};

export const ROLE_DESCRIPTION: Record<AdminRole, string> = {
  support:
    "Help customers through the support queue. Limited, customer-authorized website assistance; sensitive requests go to an owner. No payments, private customer records, passwords or team access.",
  editor:
    "Create, edit, publish and unpublish Blog and Releases & Updates, and manage NEW badges. No access to money or business accounts.",
  owner:
    "Everything: businesses, broadcasts, the lead engine, money and team accounts.",
  affiliate_manager:
    "The partner programme: approve or decline applications, record payouts, and see the reports.",
  analyst: "Read-only. Can see the insight reports and change nothing.",
};

/**
 * Where to send somebody after sign-in.
 *
 * Every role lands on insights, and that is not laziness: it is the one page all
 * three can see, so there is no redirect loop and no 403 greeting. A role exists
 * that cannot see it? Then this is the line to change.
 */
export const LANDING_PATH = "/admin/insights";

export interface AdminNavItem {
  href: string;
  label: string;
  /** The capability required to see it. */
  capability: AdminCapability;
}

/**
 * The navigation, filtered by capability.
 *
 * Order is by how often an operator needs it, which is not the same as the order
 * the pages were built in: insights first because it is where you find out what
 * needs attention, then the queues.
 */
export const ADMIN_NAV: AdminNavItem[] = [
  {
    href: "/admin/support",
    label: "Support inbox",
    capability: "manage_support",
  },
  {
    href: "/admin/reviews",
    label: "Customer reviews",
    capability: "publish_reviews",
  },
  {
    href: "/admin/business-email",
    label: "Business Email",
    capability: "manage_email",
  },
  {
    href: "/admin/features",
    label: "Feature Management",
    capability: "manage_features",
  },
  {
    href: "/admin/partners",
    label: "Partners",
    capability: "manage_affiliates",
  },
  {
    href: "/admin/custom-projects",
    label: "Custom Projects",
    capability: "manage_custom",
  },
  {
    href: "/admin/domains",
    label: "Domain orders",
    capability: "manage_domains",
  },
  {
    href: "/admin/content",
    label: "Blog & updates",
    capability: "manage_content",
  },
  { href: "/admin/insights", label: "Insights", capability: "view_insights" },
  {
    href: "/admin/affiliates",
    label: "Affiliates",
    capability: "manage_affiliates",
  },
  { href: "/admin", label: "Businesses", capability: "view_businesses" },
  {
    href: "/admin/prospects",
    label: "Lead engine",
    capability: "run_lead_engine",
  },
  {
    href: "/admin/clients",
    label: "Existing clients",
    capability: "run_lead_engine",
  },
  {
    href: "/admin/broadcasts",
    label: "Broadcasts",
    capability: "send_broadcasts",
  },
  {
    href: "/admin/website-refunds",
    label: "Website refunds",
    capability: "manage_team",
  },
  { href: "/admin/team", label: "Team", capability: "manage_team" },
];

export function navFor(role: AdminRole): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => can(role, item.capability));
}
