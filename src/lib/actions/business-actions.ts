"use server";

import { getBusinessProfile, isSubdomainAvailable, updateBusinessProfile, updateWebsiteSettings } from "@/lib/db/organizations";
import { requireSession } from "@/lib/session";
import { persistImage, deleteImageIfBlob } from "@/lib/blob";
import { subdomainFormatError } from "@/lib/subdomain";
import type { ActionResult } from "./types";
import type { BusinessProfile } from "@/lib/types";

export async function updateBusinessProfileAction(
  patch: Pick<BusinessProfile, "displayName" | "phone" | "email" | "address" | "city" | "state">,
): Promise<ActionResult<BusinessProfile>> {
  try {
    const { organizationId } = await requireSession();
    const profile = await updateBusinessProfile(organizationId, patch);
    if (!profile) return { ok: false, error: "Business profile not found." };
    return { ok: true, data: profile };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't update your business details." };
  }
}

export interface WebsiteSettingsInput {
  subdomain: string;
  tagline: string;
  themeColor: string;
  /** A data URL for a newly-picked logo, an existing hosted URL to leave as
   * is, or null to remove the logo entirely. */
  logoUrl: string | null;
  published: boolean;
}

/**
 * Saves the public-website settings (subdomain, tagline, brand color, logo,
 * publish toggle). Deliberately NOT routed through the offline-sync outbox
 * that every other mutation in this app uses: subdomain uniqueness can only
 * be checked meaningfully against the live database, so this is a plain,
 * directly-awaited action that requires being online — same reasoning as
 * password changes.
 */
export async function updateWebsiteSettingsAction(input: WebsiteSettingsInput): Promise<ActionResult<BusinessProfile>> {
  try {
    const { organizationId } = await requireSession();

    const subdomain = input.subdomain.trim().toLowerCase();
    const formatError = subdomainFormatError(subdomain);
    if (formatError) return { ok: false, error: formatError };

    const available = await isSubdomainAvailable(subdomain, organizationId);
    if (!available) return { ok: false, error: "That address is already taken — please choose another." };

    const previous = await getBusinessProfile(organizationId);
    const logoUrl = (await persistImage(input.logoUrl, "logos")) ?? null;

    const profile = await updateWebsiteSettings(organizationId, {
      subdomain,
      tagline: input.tagline.trim(),
      themeColor: input.themeColor,
      logoUrl,
      published: input.published,
    });
    if (!profile) return { ok: false, error: "Business profile not found." };

    if (previous?.logoUrl && previous.logoUrl !== logoUrl) void deleteImageIfBlob(previous.logoUrl);
    return { ok: true, data: profile };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't save your website settings." };
  }
}
