import { embedTicket, failure } from "@/lib/chatbot/public";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return await embedTicket(req, (await params).id);
  } catch (error) {
    return failure(error);
  }
}
export async function OPTIONS(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return await embedTicket(req, (await params).id);
  } catch (error) {
    return failure(error);
  }
}
