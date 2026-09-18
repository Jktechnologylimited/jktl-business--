"use server";

import { createCustomer, findCustomerByPhone } from "@/lib/db/customers";
import { getOrganizationIdBySubdomain } from "@/lib/db/public";
import { createPublicBooking } from "@/lib/db/bookings";
import { getService } from "@/lib/db/services";
import { getBusinessProfile, getOwnerEmail } from "@/lib/db/organizations";
import { sendNewBookingRequestEmail } from "@/lib/email";
import type { ActionResult } from "./types";
import type { Booking } from "@/lib/types";

/**
 * The one genuinely public, unauthenticated write path in this app — a
 * visitor on businessname.jktl.com.ng booking an appointment with no
 * account. Nothing here trusts a client-supplied organization id: the
 * subdomain is resolved server-side first, and every subsequent lookup
 * (service, customer) is scoped to that resolved id.
 */
export interface PublicBookingInput {
  serviceId: string;
  startsAt: string;
  notes: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
}

export async function createPublicBookingAction(subdomain: string, input: PublicBookingInput): Promise<ActionResult<Booking>> {
  try {
    const organizationId = await getOrganizationIdBySubdomain(subdomain.trim().toLowerCase());
    if (!organizationId) return { ok: false, error: "This page isn't available." };

    const guestName = input.guestName.trim();
    if (!guestName) return { ok: false, error: "Please enter your name." };
    if (!input.serviceId) return { ok: false, error: "Please choose a service." };
    if (!input.startsAt) return { ok: false, error: "Please choose a date and time." };

    const service = await getService(organizationId, input.serviceId);
    if (!service || !service.active) return { ok: false, error: "That service isn't available right now." };

    const guestPhone = input.guestPhone.trim();
    const existing = await findCustomerByPhone(organizationId, guestPhone);
    const customer =
      existing ??
      (await createCustomer(organizationId, crypto.randomUUID(), {
        name: guestName,
        phone: guestPhone,
        email: input.guestEmail.trim(),
        gender: "",
        notes: "",
      }));

    const booking = await createPublicBooking(organizationId, crypto.randomUUID(), {
      customerId: customer.id,
      serviceId: input.serviceId,
      startsAt: input.startsAt,
      notes: input.notes.trim(),
    });
    if (!booking) return { ok: false, error: "That service isn't available right now." };

    // Best-effort: the booking is already saved either way.
    void (async () => {
      const [profile, ownerEmail] = await Promise.all([getBusinessProfile(organizationId), getOwnerEmail(organizationId)]);
      if (profile && ownerEmail) {
        void sendNewBookingRequestEmail({
          to: ownerEmail,
          businessName: profile.displayName,
          customerName: guestName,
          customerPhone: guestPhone,
          serviceName: service.name,
          requestedAt: booking.startsAt,
        });
      }
    })();

    return { ok: true, data: booking };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't submit your booking — please try again." };
  }
}
