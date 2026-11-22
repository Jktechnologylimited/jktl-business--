import { getAdminSession } from "@/lib/admin-session";
import { redirect } from "next/navigation";
import { can } from "@/lib/admin-permissions";
import { SectionNav } from "@/components/admin/section-nav";
export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  const actor = await getAdminSession();
  if (!actor) redirect("/admin/login");
  return <div className="space-y-4"><SectionNav label="Team sections" items={[
    ...(can(actor.role, "manage_team", actor.permissions) ? [{ label: "Members & roles", href: "/admin/team" }] : []),
    { label: "Structure", href: "/admin/team/structure" },
    ...(can(actor.role, "growth_workspace", actor.permissions) ? [{ label: "Growth & Gaming", href: "/admin/growth" }] : []),
    { label: "My payment details", href: "/admin/team/payment-details" },
    ...(can(actor.role, "manage_team_payments", actor.permissions) ? [{ label: "Payment review", href: "/admin/team/payments" }] : []),
  ]} />{children}</div>;
}
