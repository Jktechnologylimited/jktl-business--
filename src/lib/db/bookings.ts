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
