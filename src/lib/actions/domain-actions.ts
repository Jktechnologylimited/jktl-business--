"use server";

import { randomBytes } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import { requireSession } from "@/lib/session";
import { isSubscriptionActive } from "@/lib/db/billing";
import { isCustomDomainTaken, startCustomDomain, getPendingCustomDomain, markCustomDomainVerified, clearCustomDomain } from "@/lib/db/domain";
import { customDomainFormatError, normalizeDomain, verificationRecordName, verificationRecordValue } from "@/lib/domain";
import type { ActionResult } from "./types";
import type { BusinessProfile } from "@/lib/types";

/**
 * Custom-domain mapping: a business points their own domain (e.g.
 * www.glamhairstudio.com) at their JKTL site instead of / alongside their
 * free *.jktl.com.ng subdomain. Chosen deliberately as a *manual* flow —
 * per your call, matching how you already manage jktl.com.ng's own domain
 * in Vercel by hand: JKTL Business only verifies the person controls the
 * domain (a DNS TXT record) and remembers it; actually adding the domain
 * to the Vercel project (so Vercel issues its SSL certificate) is a step
 * you or the business does directly in the Vercel dashboard. No Vercel API
 * token needed anywhere in this flow.
 */

export interface CustomDomainStartResult {
  profile: BusinessProfile;
  recordName: string;
  recordValue: string;
}

/** Requires an active subscription — this is the one thing that actually
 * costs something ongoing (each verified custom domain is one more entry
 * `middleware.ts` has to resolve, plus whatever it costs you in Vercel to
 * keep issuing/renewing that domain's SSL certificate). */
export async function startCustomDomainVerificationAction(domainInput: string): Promise<ActionResult<CustomDomainStartResult>> {
  try {
    const { organizationId } = await requireSession();
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "jktl.com.ng";
    const domain = normalizeDomain(domainInput);

    const formatError = customDomainFormatError(domain, rootDomain);
    if (formatError) return { ok: false, error: formatError };

    const active = await isSubscriptionActive(organizationId);
    if (!active) return { ok: false, error: "Upgrade to Website & Hosting under Settings → Plan to add a custom domain." };

    const taken = await isCustomDomainTaken(domain, organizationId);
    if (taken) return { ok: false, error: "That domain is already connected to another business." };

    const token = randomBytes(16).toString("hex");
    const profile = await startCustomDomain(organizationId, domain, token);
    if (!profile) return { ok: false, error: "Business profile not found." };

    return {
      ok: true,
      data: { profile, recordName: verificationRecordName(domain), recordValue: verificationRecordValue(token) },
    };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't start domain verification." };
  }
}

/**
 * Looks up the DNS TXT record and, if it matches, marks the domain
 * verified — from that point, `middleware.ts` will route traffic for it.
 * A missing or mismatched record is a normal, expected outcome (DNS can
 * take anywhere from a minute to a few hours to propagate), not a bug —
 * the person just tries again once they've added the record.
 */
export async function verifyCustomDomainAction(): Promise<ActionResult<BusinessProfile>> {
  try {
    const { organizationId } = await requireSession();
    const pending = await getPendingCustomDomain(organizationId);
    if (!pending) return { ok: false, error: "Add a domain first." };

    const expected = verificationRecordValue(pending.token);
    let records: string[][];
    try {
      records = await resolveTxt(verificationRecordName(pending.domain));
    } catch {
      return {
        ok: false,
        error: "We couldn't find that DNS record yet — it can take a few minutes (sometimes longer) to propagate. Try again shortly.",
      };
    }

    const found = records.some((chunks) => chunks.join("") === expected);
    if (!found) {
      return { ok: false, error: "That DNS record doesn't match yet — double check what you added, then try again." };
    }

    const profile = await markCustomDomainVerified(organizationId);
    if (!profile) return { ok: false, error: "Business profile not found." };
    return { ok: true, data: profile };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't verify your domain." };
  }
}

export async function removeCustomDomainAction(): Promise<ActionResult<BusinessProfile>> {
  try {
    const { organizationId } = await requireSession();
    const profile = await clearCustomDomain(organizationId);
    if (!profile) return { ok: false, error: "Business profile not found." };
    return { ok: true, data: profile };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't remove your custom domain." };
  }
}
