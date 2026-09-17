"use server";

import * as db from "@/lib/db/expenses";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "./types";
import type { Expense } from "@/lib/types";

export async function createExpenseAction(id: string, input: db.ExpenseInput): Promise<ActionResult<Expense>> {
  try {
    const { organizationId } = await requireSession();
    return { ok: true, data: await db.createExpense(organizationId, id, input) };
  } catch {
    return { ok: false, error: "Couldn't save this expense." };
  }
}

export async function deleteExpenseAction(id: string): Promise<ActionResult<null>> {
  try {
    const { organizationId } = await requireSession();
    await db.deleteExpense(organizationId, id);
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: "Couldn't delete this expense." };
  }
}
