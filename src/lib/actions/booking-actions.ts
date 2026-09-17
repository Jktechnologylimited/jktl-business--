"use server";

import * as db from "@/lib/db/bookings";
import { getCustomer } from "@/lib/db/customers";
import { getService } from "@/lib/db/services";
import { getBusinessProfile } from "@/lib/db/organizations";
import { requireSession } from "@/lib/session";
import { sendBookingConfirmationEmail } from "@/lib/email";
import type { ActionResult } from "./types";
import type { Booking, BookingStatus } from "@/lib/types";

async function notifyIfConfirmed(organizationId: string, booking: Booking): Promise<void> {
  if (booking.status !== "confirmed") return;
  try {
    const [customer, service, profile] = await Promise.all([
      getCustomer(organizationId, booking.customerId),
      getService(organizationId, booking.serviceId),
      getBusinessProfile(organizationId),
    ]);
    if (!customer?.email || !service || !profile) return;
    await sendBookingConfirmationEmail({
      to: customer.email,
      customerName: customer.name,
      businessName: profile.displayName,
      serviceName: service.name,
      startsAt: booking.startsAt,
    }).catch(() => undefined);
  } catch {
    // Notification is best-effort — never let it affect the booking result.
  }
}

export async function createBookingAction(id: string, input: db.BookingInput): Promise<ActionResult<Booking>> {
  try {
    const { organizationId } = await requireSession();
    const booking = await db.createBooking(organizationId, id, input);
    await notifyIfConfirmed(organizationId, booking);
    return { ok: true, data: booking };
  } catch {
    return { ok: false, error: "Couldn't save this booking." };
  }
}

export async function updateBookingAction(id: string, input: db.BookingInput): Promise<ActionResult<Booking>> {
  try {
    const { organizationId } = await requireSession();
    const booking = await db.updateBooking(organizationId, id, input);
    if (!booking) return { ok: false, error: "Booking not found." };
    await notifyIfConfirmed(organizationId, booking);
    return { ok: true, data: booking };
  } catch {
    return { ok: false, error: "Couldn't update this booking." };
  }
}

export async function updateBookingStatusAction(id: string, status: BookingStatus): Promise<ActionResult<Booking>> {
  try {
    const { organizationId } = await requireSession();
    const booking = await db.updateBookingStatus(organizationId, id, status);
    if (!booking) return { ok: false, error: "Booking not found." };
    await notifyIfConfirmed(organizationId, booking);
    return { ok: true, data: booking };
  } catch {
    return { ok: false, error: "Couldn't update this booking." };
  }
}

export async function deleteBookingAction(id: string): Promise<ActionResult<null>> {
  try {
    const { organizationId } = await requireSession();
    await db.deleteBooking(organizationId, id);
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: "Couldn't delete this booking." };
  }
}
