import { lead, failure } from "@/lib/chatbot/public";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    return await lead(req);
  } catch (error) {
    return failure(error);
  }
}
