import { getSql } from "./client";
import { kobo } from "./rows";
import type { Service } from "@/lib/types";

function mapRow(row: Record<string, unknown>): Service {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    name: row.name as string,
    category: row.category as string,
    priceKobo: kobo(row.price_kobo as string),
    durationMin: Number(row.duration_min),
    description: row.description as string,
    active: row.active as boolean,
    imageUrl: (row.image_url as string) ?? null,
  };
}

export async function listServices(orgId: string): Promise<Service[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM services WHERE organization_id = ${orgId} ORDER BY created_at DESC`;
  return rows.map(mapRow);
}

export async function getService(orgId: string, id: string): Promise<Service | null> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM services WHERE id = ${id} AND organization_id = ${orgId}`;
  return rows[0] ? mapRow(rows[0]) : null;
}

export interface ServiceInput {
  name: string;
  category: string;
  priceKobo: number;
  durationMin: number;
  description: string;
  active: boolean;
  /** A data URL for a newly-picked photo, an existing hosted URL to leave
   * as is, or null/undefined for no photo. */
  imageUrl?: string | null;
}

export async function createService(orgId: string, id: string, input: ServiceInput): Promise<Service> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO services (id, organization_id, name, category, price_kobo, duration_min, description, active, image_url)
    VALUES (${id}, ${orgId}, ${input.name}, ${input.category}, ${input.priceKobo}, ${input.durationMin}, ${input.description}, ${input.active}, ${input.imageUrl ?? null})
    ON CONFLICT (id) DO UPDATE SET
      name = excluded.name, category = excluded.category, price_kobo = excluded.price_kobo,
      duration_min = excluded.duration_min, description = excluded.description, active = excluded.active,
      image_url = excluded.image_url
    RETURNING *
  `;
  return mapRow(rows[0]);
}

export async function updateService(orgId: string, id: string, input: ServiceInput): Promise<Service | null> {
  const sql = getSql();
  const rows = await sql`
    UPDATE services
    SET name = ${input.name}, category = ${input.category}, price_kobo = ${input.priceKobo},
        duration_min = ${input.durationMin}, description = ${input.description}, active = ${input.active},
        image_url = ${input.imageUrl ?? null}
    WHERE id = ${id} AND organization_id = ${orgId}
    RETURNING *
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deleteService(orgId: string, id: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM services WHERE id = ${id} AND organization_id = ${orgId}`;
}
