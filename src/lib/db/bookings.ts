import { getSql } from "./client";
import { isoDate, kobo } from "./rows";
import type { Booking, BookingStatus } from "@/lib/types";

function mapRow(row: Record<string, unknown>): Booking {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    customerId: row.customer_id as string,
    serviceId: row.service_id as string,
    staffId: row.staff_id as string,
    startsAt: isoDate(row.starts_at as string),
    status: row.status as BookingStatus,
    notes: row.notes as string,
    priceKobo: kobo(row.price_kobo as string),
  };
}

export async function listBookings(orgId: string): Promise<Booking[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM bookings WHERE organization_id = ${orgId} ORDER BY starts_at DESC`;
  return rows.map(mapRow);
}

export interface BookingInput {
  customerId: string;
  serviceId: string;
  staffId: string;
  startsAt: string;
  status: BookingStatus;
  notes: string;
  priceKobo: number;
}

export async function createBooking(orgId: string, id: string, input: BookingInput): Promise<Booking> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO bookings (id, organization_id, customer_id, service_id, staff_id, starts_at, status, notes, price_kobo)
    VALUES (${id}, ${orgId}, ${input.customerId}, ${input.serviceId}, ${input.staffId}, ${input.startsAt}, ${input.status}, ${input.notes}, ${input.priceKobo})
    ON CONFLICT (id) DO UPDATE SET
      customer_id = excluded.customer_id, service_id = excluded.service_id, staff_id = excluded.staff_id,
      starts_at = excluded.starts_at, status = excluded.status, notes = excluded.notes, price_kobo = excluded.price_kobo
    RETURNING *
  `;
  return mapRow(rows[0]);
}

export async function updateBooking(orgId: string, id: string, input: BookingInput): Promise<Booking | null> {
  const sql = getSql();
  const rows = await sql`
    UPDATE bookings
    SET customer_id = ${input.customerId}, service_id = ${input.serviceId}, staff_id = ${input.staffId},
        starts_at = ${input.startsAt}, status = ${input.status}, notes = ${input.notes}, price_kobo = ${input.priceKobo}
    WHERE id = ${id} AND organization_id = ${orgId}
    RETURNING *
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export interface PublicBookingInput {
  customerId: string;
  serviceId: string;
  startsAt: string;
  notes: string;
}

/**
 * Creates a booking from the public, unauthenticated site — the guest-facing
 * counterpart to `createBooking`. Two things are deliberately different from
 * the staff-facing version:
 *   - `staff_id` is always '' (the public booking flow never lets a guest
 *     pick a staff member — that's assigned internally later).
 *   - `price_kobo` is read from the service row itself rather than trusted
 *     from the client, so a tampered request can't book a service at an
 *     arbitrary price.
 * Both the price lookup and the insert happen in one CTE so a service that
 * doesn't belong to this org (or was deleted) simply yields no booking,
 * rather than a booking with a fabricated price.
 */
export async function createPublicBooking(orgId: string, id: string, input: PublicBookingInput): Promise<Booking | null> {
  const sql = getSql();
  const rows = await sql`
    WITH svc AS (
      SELECT id, price_kobo FROM services WHERE id = ${input.serviceId} AND organization_id = ${orgId}
    ),
    new_booking AS (
      INSERT INTO bookings (id, organization_id, customer_id, service_id, staff_id, starts_at, status, notes, price_kobo)
      SELECT ${id}, ${orgId}, ${input.customerId}, svc.id, '', ${input.startsAt}, 'pending', ${input.notes}, svc.price_kobo
      FROM svc
      RETURNING *
    )
    SELECT * FROM new_booking
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function updateBookingStatus(orgId: string, id: string, status: BookingStatus): Promise<Booking | null> {
  const sql = getSql();
  const rows = await sql`
    UPDATE bookings SET status = ${status} WHERE id = ${id} AND organization_id = ${orgId} RETURNING *
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deleteBooking(orgId: string, id: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM bookings WHERE id = ${id} AND organization_id = ${orgId}`;
}
