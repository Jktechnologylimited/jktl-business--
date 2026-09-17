import { getSql } from "./client";
import { isoDate, kobo } from "./rows";
import type { Expense, PaymentMethod } from "@/lib/types";

function mapRow(row: Record<string, unknown>): Expense {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    description: row.description as string,
    category: row.category as Expense["category"],
    amountKobo: kobo(row.amount_kobo as string),
    paymentMethod: row.payment_method as PaymentMethod,
    date: isoDate(row.date as string),
    notes: row.notes as string,
  };
}

export async function listExpenses(orgId: string): Promise<Expense[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM expenses WHERE organization_id = ${orgId} ORDER BY date DESC`;
  return rows.map(mapRow);
}

export interface ExpenseInput {
  description: string;
  category: Expense["category"];
  amountKobo: number;
  paymentMethod: PaymentMethod;
  date: string;
  notes: string;
}

export async function createExpense(orgId: string, id: string, input: ExpenseInput): Promise<Expense> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO expenses (id, organization_id, description, category, amount_kobo, payment_method, date, notes)
    VALUES (${id}, ${orgId}, ${input.description}, ${input.category}, ${input.amountKobo}, ${input.paymentMethod}, ${input.date}, ${input.notes})
    ON CONFLICT (id) DO UPDATE SET
      description = excluded.description, category = excluded.category, amount_kobo = excluded.amount_kobo,
      payment_method = excluded.payment_method, date = excluded.date, notes = excluded.notes
    RETURNING *
  `;
  return mapRow(rows[0]);
}

export async function deleteExpense(orgId: string, id: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM expenses WHERE id = ${id} AND organization_id = ${orgId}`;
}
