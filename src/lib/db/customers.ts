import { getSql } from "./client";
import { isoDate } from "./rows";
import type { Customer } from "@/lib/types";

function mapRow(row: Record<string, unknown>): Customer {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    name: row.name as string,
    phone: row.phone as string,
    email: row.email as string,
    gender: row.gender as Customer["gender"],
    notes: row.notes as string,
    createdAt: isoDate(row.created_at as string),
  };
}

export async function listCustomers(orgId: string): Promise<Customer[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM customers WHERE organization_id = ${orgId} ORDER BY created_at DESC`;
  return rows.map(mapRow);
}

export async function getCustomer(orgId: string, id: string): Promise<Customer | null> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM customers WHERE id = ${id} AND organization_id = ${orgId}`;
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Used by the public booking form to avoid creating a duplicate customer
 * every time the same guest books again — matched by phone within the
 * tenant only (never across organizations). Empty phone never matches. */
export async function findCustomerByPhone(orgId: string, phone: string): Promise<Customer | null> {
  if (!phone.trim()) return null;
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM customers WHERE organization_id = ${orgId} AND phone = ${phone} ORDER BY created_at ASC LIMIT 1
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export interface CustomerInput {
  name: string;
  phone: string;
  email: string;
  gender: Customer["gender"];
  notes: string;
}

export async function createCustomer(orgId: string, id: string, input: CustomerInput): Promise<Customer> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO customers (id, organization_id, name, phone, email, gender, notes)
    VALUES (${id}, ${orgId}, ${input.name}, ${input.phone}, ${input.email}, ${input.gender}, ${input.notes})
    ON CONFLICT (id) DO UPDATE SET
      name = excluded.name, phone = excluded.phone, email = excluded.email,
      gender = excluded.gender, notes = excluded.notes
    RETURNING *
  `;
  return mapRow(rows[0]);
}

export async function updateCustomer(orgId: string, id: string, input: CustomerInput): Promise<Customer | null> {
  const sql = getSql();
  const rows = await sql`
    UPDATE customers
    SET name = ${input.name}, phone = ${input.phone}, email = ${input.email},
        gender = ${input.gender}, notes = ${input.notes}
    WHERE id = ${id} AND organization_id = ${orgId}
    RETURNING *
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deleteCustomer(orgId: string, id: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM customers WHERE id = ${id} AND organization_id = ${orgId}`;
}
