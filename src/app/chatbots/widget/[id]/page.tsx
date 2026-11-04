import { PublicChat } from "@/components/chatbot/PublicChat";
import { publicConfig } from "@/lib/chatbot/public";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Business AI assistant | JKTL",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const config = await publicConfig((await params).id).catch(() => notFound());
  return <PublicChat embedded config={config} />;
}
