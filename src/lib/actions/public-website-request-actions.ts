"use server";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { getPublicSiteBySubdomain } from "@/lib/db/public";
import { createCustomer } from "@/lib/db/customers";
import { getOwnerEmail } from "@/lib/db/organizations";
import {
  getWebsiteTemplate,
  parseWebsiteDocument,
  beautyServiceSlug,
} from "@/lib/website-templates";
import { createPublicBookingAction } from "@/lib/actions/public-actions";
import { sendWebsiteRequestEmail } from "@/lib/email";
import { rate } from "@/lib/support/service";
import type { BeautyRequest } from "@/components/templates/BeautyWebsite";
export async function submitBeautyWebsiteRequestAction(
  subdomain: string,
  input: BeautyRequest,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain) ||
      !input ||
      !["appointment", "contact"].includes(input.kind)
    )
      return { ok: false, error: "Please check your request." };
    if (typeof input.website !== "string" || input.website)
      return { ok: false, error: "Unable to submit this request." };
    const read = (key: keyof BeautyRequest, max: number) => {
      const value = input[key];
      if (typeof value !== "string" || value.length > max)
        throw Error("Please check your details.");
      return value.trim();
    };
    const name = read("name", 120),
      email = read("email", 254),
      phone = read("phone", 40),
      message = read("message", 2000),
      slug = read("service", 80),
      date = read("date", 10),
      time = read("time", 5);
    if (
      !name ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !/^\+?[\d ()-]{7,40}$/.test(phone) ||
      phone.replace(/\D/g, "").length < 7 ||
      phone.replace(/\D/g, "").length > 15 ||
      (input.kind === "contact" && !message)
    )
      return {
        ok: false,
        error:
          "Enter your name, a valid email and phone number, and your message.",
      };
    const requestHeaders = await headers();
    const ip =
      requestHeaders.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    // Existing rate-limit storage. Hash identifiers; never store a raw IP/email as the rate key.
    await rate(
      "salon-request-ip:" +
        createHash("sha256")
          .update(subdomain + ":" + ip)
          .digest("hex"),
      10,
    );
    const site = await getPublicSiteBySubdomain(subdomain);
    if (
      !site?.profile.published ||
      !getWebsiteTemplate(site.profile.websiteTemplateId)
    )
      return { ok: false, error: "This website is not accepting requests." };
    const doc = parseWebsiteDocument(site.profile.websiteDocument);
    if (!doc.beauty)
      return { ok: false, error: "This website is not accepting requests." };
    const organizationId = site.profile.organizationId;
    await rate("salon-request-org:" + organizationId, 60);
    await rate(
      "salon-request-email:" +
        createHash("sha256")
          .update(organizationId + ":" + email.toLowerCase())
          .digest("hex"),
      4,
    );
    const offer = doc.offerings.find(
      (s, i) => beautyServiceSlug(s, i) === slug,
    );
    let startsAt = "";
    if (input.kind === "appointment") {
      if (
        !offer ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
      )
        return { ok: false, error: "Choose a service, date and time." };
      const instant = new Date(`${date}T${time}:00+01:00`);
      // Salon requests use WAT, independent of the visitor's device timezone.
      if (
        Number.isNaN(instant.getTime()) ||
        instant.getTime() < Date.now() ||
        instant.getTime() > Date.now() + 366 * 86400000 ||
        new Date(instant.getTime() + 3600000).toISOString().slice(0, 16) !==
          `${date}T${time}`
      )
        return {
          ok: false,
          error:
            "Choose a valid future date and time within the next year (WAT).",
        };
      startsAt = instant.toISOString();
      const service = site.services.find(
        (s) =>
          s.active &&
          s.name.trim().toLowerCase() === offer.title.trim().toLowerCase(),
      );
      if (service) {
        // The existing booking path rechecks tenant scope and uses the actual
        // service/duration/price. Display/demo prices are never charged or trusted.
        const result = await createPublicBookingAction(subdomain, {
          serviceId: service.id,
          startsAt,
          notes: message,
          guestName: name,
          guestPhone: phone,
          guestEmail: email,
        });
        return result.ok ? { ok: true } : { ok: false, error: result.error };
      }
    }
    // Enquiries and appointments without a configured booking service are
    // saved to the existing customer inbox/notes, not a fabricated reservation.
    const summary =
      input.kind === "appointment"
        ? `Appointment request: ${offer!.title}\nPreferred visit: ${date} at ${time} WAT (not confirmed)`
        : "Website contact enquiry";
    await createCustomer(organizationId, crypto.randomUUID(), {
      name,
      phone,
      email,
      gender: "",
      notes: `${summary}\n${message}\nSource: published website`,
    });
    // Storage success is authoritative. Notification is best effort, as in
    // the existing public-booking flow; a provider failure must not lose a lead.
    try {
      const owner = await getOwnerEmail(organizationId);
      if (owner)
        await sendWebsiteRequestEmail({
          to: owner,
          businessName: doc.brandName,
          name,
          email,
          phone,
          detail: `${summary}\n${message}`,
        });
    } catch {
      /* Saved request remains in Customers. */
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      error:
        "We could not save your request. Please try again shortly or contact the salon directly.",
    };
  }
}
