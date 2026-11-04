"use server";
import { revalidatePath } from "next/cache";
import {
  change,
  conversation,
  dashboard,
  reply,
} from "@/lib/chatbot/management";
import { safeError } from "@/lib/chatbot/model";
export async function chatbotHome(target?: string) {
  return dashboard(target);
}
export async function chatbotChange(
  target: string | undefined,
  operation: string,
  input: Record<string, unknown>,
) {
  try {
    const result = await change(target, operation, input);
    revalidatePath("/business/chatbot");
    revalidatePath("/partners/chatbot");
    return { ok: true as const, result };
  } catch (error) {
    return {
      ok: false as const,
      error:
        /(check|Choose|Enter|Reload|TXT|required|must|not authorized|not found|Sign in)/.test(
          String(error instanceof Error ? error.message : ""),
        )
          ? (error as Error).message
          : safeError(error),
    };
  }
}
export async function chatbotConversation(
  target: string | undefined,
  bot: string,
  id: string,
) {
  return conversation(target, bot, id);
}
export async function chatbotReply(
  target: string | undefined,
  bot: string,
  id: string,
  message: string,
) {
  try {
    await reply(target, bot, id, message);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error:
        "This conversation cannot be updated with your current access or plan.",
    };
  }
}
