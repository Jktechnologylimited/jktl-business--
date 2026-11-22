import { SectionNav } from "@/components/admin/section-nav";
export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4"><SectionNav label="Customer support" items={[
    { label: "Inbox", href: "/admin/support" },
    { label: "Follow-ups", href: "/admin/support/follow-ups" },
    { label: "Account setup", href: "/admin/support/care" },
  ]} />{children}</div>;
}
