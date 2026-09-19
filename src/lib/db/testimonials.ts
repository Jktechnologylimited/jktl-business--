import { getSql } from "./client";
import { isoDate } from "./rows";
import type { Testimonial } from "@/lib/types";

function mapRow(row: Record<string, unknown>): Testimonial {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    customerName: row.customer_name as string,
    quote: row.quote as string,
    rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
    createdAt: isoDate(row.created_at as string),
  };
}

export async function listTestimonials(orgId: string): Promise<Testimonial[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM testimonials WHERE organization_id = ${orgId} ORDER BY created_at DESC`;
  return rows.map(mapRow);
}

/** Public read (no auth) — active/published testimonials for a business's
 * storefront. Same trust boundary as `db/public.ts`'s other reads: takes an
 * organization id already resolved from a subdomain lookup, never one
 * supplied directly by a visitor. */
export async function listPublicTestimonials(orgId: string): Promise<Testimonial[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM testimonials WHERE organization_id = ${orgId} ORDER BY created_at DESC`;
  return rows.map(mapRow);
}

export interface TestimonialInput {
  customerName: string;
  quote: string;
  rating: number | null;
}

export async function createTestimonial(orgId: string, id: string, input: TestimonialInput): Promise<Testimonial> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO testimonials (id, organization_id, customer_name, quote, rating)
    VALUES (${id}, ${orgId}, ${input.customerName}, ${input.quote}, ${input.rating})
    ON CONFLICT (id) DO UPDATE SET
      customer_name = excluded.customer_name, quote = excluded.quote, rating = excluded.rating
    RETURNING *
  `;
  return mapRow(rows[0]);
}

export async function updateTestimonial(orgId: string, id: string, input: TestimonialInput): Promise<Testimonial | null> {
  const sql = getSql();
  const rows = await sql`
    UPDATE testimonials
    SET customer_name = ${input.customerName}, quote = ${input.quote}, rating = ${input.rating}
    WHERE id = ${id} AND organization_id = ${orgId}
    RETURNING *
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deleteTestimonial(orgId: string, id: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM testimonials WHERE id = ${id} AND organization_id = ${orgId}`;
}
