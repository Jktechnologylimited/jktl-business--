import { SectionNav } from "@/components/admin/section-nav";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <SectionNav label="Affiliate management" items={[
        { label: "Overview", href: "/admin/affiliates" },
        { label: "Accounts", href: "/admin/affiliates#accounts" },
        { label: "Referrals & earnings", href: "/admin/distribution/finance" },
        { label: "Marketing materials", href: "/admin/distribution/resources" },
        { label: "Support", href: "/admin/partner-support" },
        { label: "Settings", href: "/admin/affiliates/settings" },
      ]} />
      {children}
    </div>
  );
}
