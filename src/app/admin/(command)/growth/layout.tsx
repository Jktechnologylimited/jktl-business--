import { SectionNav } from "@/components/admin/section-nav";
import { growth } from "@/lib/growth/service";
import { can } from "@/lib/admin-permissions";
import { growthModules } from "@/lib/growth/modules";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const a = await growth();
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-gold">
          JKTL Business · Team workspace
        </p>
        <h1 className="text-2xl font-semibold text-ink">Growth & Gaming</h1>
      </div>
      <SectionNav label="Growth & Gaming" items={[
        { label: "Overview", href: "/admin/growth" },
        ...growthModules
          .filter((m) => can(a.role, m.permission, a.permissions))
          .map(m => ({ label: m.label, href: "/admin/growth/" + m.slug }))
      ]} />
      {children}
    </div>
  );
}
