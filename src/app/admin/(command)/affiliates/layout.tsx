import Link from "next/link";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <nav
        aria-label="Affiliate management"
        className="flex flex-wrap gap-4 border-b border-border pb-4"
      >
        {[
          ["Overview", "/admin/affiliates"],
          ["Accounts", "/admin/affiliates#accounts"],
          ["Referrals & Earnings", "/admin/distribution/finance"],
          ["Marketing Materials", "/admin/distribution/resources"],
          ["Support", "/admin/partner-support"],
          ["Settings", "/admin/affiliates/settings"],
        ].map(([label, href]) => (
          <Link key={label} className="text-sm underline" href={href}>
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
