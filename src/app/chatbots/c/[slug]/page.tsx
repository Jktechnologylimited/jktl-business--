import { PublicChat } from "@/components/chatbot/PublicChat";
import { publicConfig } from "@/lib/chatbot/public";
import { query, ticket } from "@/lib/chatbot/store";
import { publicOrigin } from "@/lib/chatbot/model";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Chat with a business | JKTL AI Chatbot",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const row = (
    await query(
      "SELECT id FROM chatbots WHERE slug=$1 AND deleted_at IS NULL",
      [(await params).slug],
    )
  )[0];
  if (!row) notFound();
  const config = await publicConfig(String(row.id)).catch(() => notFound());
  const proof = await ticket(String(row.id), publicOrigin(), "standalone");
  return <PublicChat config={config} ticket={proof} />;
}
