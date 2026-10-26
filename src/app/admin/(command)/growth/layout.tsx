import Link from "next/link";
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
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-gold">
          JKTL Business · Staff workspace
        </p>
        <h1 className="text-3xl font-semibold text-ink">Growth & Gaming</h1>
      </div>
      <nav aria-label="Growth & Gaming" className="flex flex-wrap gap-2">
        <Link
          className="rounded-lg border border-border p-3 text-sm"
          href="/admin/growth"
        >
          Overview
        </Link>
        {growthModules
          .filter((m) => can(a.role, m.permission, a.permissions))
          .map((m) => (
            <Link
              key={m.slug}
              className="rounded-lg border border-border p-3 text-sm"
              href={"/admin/growth/" + m.slug}
            >
              {m.label}
            </Link>
          ))}
      </nav>
      {children}
    </div>
  );
}
