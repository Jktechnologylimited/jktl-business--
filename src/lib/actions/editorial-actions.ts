"use server";
import { revalidatePath } from "next/cache";
import { requireAdminCapability } from "@/lib/admin-session";
import { parsePublication } from "@/lib/publications";
import { saveEditorial } from "@/lib/db/publications";
export async function savePublicationAction(raw: unknown) {
  try {
    const admin = await requireAdminCapability("manage_content");
    const input = parsePublication(raw);
    const article = await saveEditorial(input, admin.id);
    revalidatePath("/admin/content");
    return { ok: true as const, article };
  } catch (e) {
    const text = e instanceof Error ? e.message : "";
    const known =
      /Check |Choose |Use |Invalid |Add at least|This article changed|That URL is already|Your role|Not signed in/.test(
        text,
      );
    return {
      ok: false as const,
      error: known
        ? text
        : "Could not save this article. Your changes are still in the editor. Please retry.",
    };
  }
}
