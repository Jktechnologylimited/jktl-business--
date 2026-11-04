import { ChatbotAdmin } from "@/components/chatbot/Admin";
import { chatbotAdminHome } from "@/lib/actions/chatbot-admin-actions";
export const dynamic = "force-dynamic";
export default async function Page() {
  return <ChatbotAdmin initial={await chatbotAdminHome()} />;
}
