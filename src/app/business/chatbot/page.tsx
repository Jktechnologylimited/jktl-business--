import { ChatbotDashboard } from "@/components/chatbot/Dashboard";
import { dashboard } from "@/lib/chatbot/management";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!(await getSession())) redirect("/login");
  return <ChatbotDashboard initial={await dashboard()} />;
}
