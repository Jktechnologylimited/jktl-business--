import { WIDGET_LOADER } from "@/lib/chatbot/loader";
export async function GET() {
  return new Response(WIDGET_LOADER, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-JKTL-Widget": "1",
    },
  });
}
