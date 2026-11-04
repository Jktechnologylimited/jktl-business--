import Link from "next/link";
import { approvedPartner } from "@/lib/partners/access";
import { query } from "@/lib/chatbot/store";
import { dashboard } from "@/lib/chatbot/management";
import { ChatbotDashboard } from "@/components/chatbot/Dashboard";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const partner = await approvedPartner(),
    org = (await searchParams).org;
  if (org)
    return <ChatbotDashboard target={org} initial={await dashboard(org)} />;
  const clients = await query(
    "SELECT a.organization_id,p.display_name FROM partner_client_access a JOIN business_profiles p ON p.organization_id=a.organization_id WHERE a.partner_id=$1 AND a.revoked_at IS NULL AND 'MANAGE_CHATBOT'=ANY(a.scopes)",
    [partner.id],
  );
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold">Client AI chatbots</h1>
      <p className="my-4">
        Only clients who explicitly granted Manage Chatbot access appear here.
        Their own subscription limits apply.
      </p>
      {clients.map((client) => (
        <Link
          key={String(client.organization_id)}
          className="my-3 block rounded-2xl border border-border p-4 text-primary"
          href={"/partners/chatbot?org=" + client.organization_id}
        >
          {String(client.display_name)}
        </Link>
      ))}
      <Link href="/partners/support" className="underline">
        Request JKTL support
      </Link>
    </main>
  );
}
