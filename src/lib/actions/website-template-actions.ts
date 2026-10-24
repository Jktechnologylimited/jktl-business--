"use server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getSql, isSchemaOutOfDateError } from "@/lib/db/client";
import { getBusinessProfile } from "@/lib/db/organizations";
import {
  getWebsiteTemplate,
  parseWebsiteDocument,
} from "@/lib/website-templates";
import { saveTemplateDocument } from "@/lib/website-template-store";
import type { WebsiteDocument } from "@/lib/website-templates";
import type { BusinessProfile } from "@/lib/types";
import type { ActionResult } from "./types";
export async function saveWebsiteTemplateAction(input: {
  templateId: string;
  document: WebsiteDocument;
  revision: number;
  published: boolean;
}): Promise<ActionResult<BusinessProfile>> {
  try {
    const session = await requireSession();
    const sql = getSql();
    const membership =
      await sql`SELECT role FROM organization_members WHERE organization_id=${session.organizationId} AND user_id=${session.userId} AND active=true AND role IN ('owner','manager') LIMIT 1`;
    if (!membership[0])
      return {
        ok: false,
        error: "Only an owner or manager can save the business website.",
      };
    if (!getWebsiteTemplate(input.templateId))
      return { ok: false, error: "Choose an available website template." };
    if (
      !Number.isInteger(input.revision) ||
      input.revision < 0 ||
      typeof input.published !== "boolean"
    )
      return { ok: false, error: "Invalid website version." };
    const document = parseWebsiteDocument(input.document);
    await saveTemplateDocument((text, params) => sql.query(text, params), {
      organizationId: session.organizationId,
      templateId: input.templateId,
      document,
      revision: input.revision,
      published: input.published,
    });
    const profile = await getBusinessProfile(session.organizationId);
    if (!profile) return { ok: false, error: "Business profile not found." };
    revalidatePath("/business/website");
    revalidatePath("/business/website/template");
    revalidatePath(`/sites/${profile.subdomain}`);
    return { ok: true, data: profile };
  } catch (error) {
    if (isSchemaOutOfDateError(error))
      return {
        ok: false,
        error:
          "Website templates are not ready on this account yet. Please contact the JKTL team.",
      };
    return {
      ok: false,
      error:
        error instanceof Error &&
        (error.message.startsWith("The website changed") ||
          error.message.startsWith("Please check") ||
          error.message.startsWith("Images must") ||
          error.message.startsWith("Choose valid") ||
          error.message.startsWith("Website content") ||
          error.message.startsWith("Invalid website") ||
          error.message.startsWith("Unsupported website"))
          ? error.message
          : "Unable to save the website. Check your sign-in and try again.",
    };
  }
}
