"use server";
import { revalidatePath } from "next/cache";
import {
  addressCheck,
  createWebsite,
  websiteList,
  saveWebsite,
} from "@/lib/websites/service";
import { getBusinessProfile } from "@/lib/db/organizations";
import { requireSession } from "@/lib/session";
import type { WebsiteDocument } from "@/lib/website-templates";
import type { ActionResult } from "./types";
import type { BusinessProfile } from "@/lib/types";
function message(e: unknown) {
  if ((e as { code?: string })?.code === "23505")
    return "That address was just taken. Choose another name or suggestion.";
  return e instanceof Error &&
    /^(Only|Choose|Must|Lowercase|That name|The website|Check|Website content|Images must|Invalid website|Unsupported website|Please check)/.test(
      e.message,
    )
    ? e.message
    : "Could not complete the website request. Check your account and try again.";
}
export async function listBusinessWebsitesAction() {
  return websiteList();
}
export async function checkWebsiteAddressAction(
  slug: string,
  exclude?: string,
) {
  return addressCheck(slug, exclude);
}
export async function createBusinessWebsiteAction(input: {
  name: string;
  subdomain: string;
  templateId: string;
}) {
  try {
    const id = await createWebsite(input);
    revalidatePath("/business/website");
    return { ok: true as const, id };
  } catch (e) {
    return { ok: false as const, error: message(e) };
  }
}
export async function saveAdditionalWebsiteAction(input: {
  id: string;
  templateId: string;
  document: WebsiteDocument;
  revision: number;
  published: boolean;
}): Promise<ActionResult<BusinessProfile>> {
  try {
    const row = await saveWebsite(input);
    const s = await requireSession(),
      base = await getBusinessProfile(s.organizationId);
    if (!base) return { ok: false, error: "Business profile not found." };
    revalidatePath("/business/website");
    revalidatePath("/sites/" + row.subdomain);
    return {
      ok: true,
      data: {
        ...base,
        id: String(row.id),
        displayName: String(row.name),
        subdomain: String(row.subdomain),
        customDomain: "",
        customDomainVerified: false,
        published: Boolean(row.published),
        websiteTemplateId: String(row.template_id),
        websiteDocument: row.document as WebsiteDocument,
        websiteRevision: Number(row.revision),
      },
    };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
