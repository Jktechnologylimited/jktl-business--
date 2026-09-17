"use server";

import * as db from "@/lib/db/customers";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "./types";
import type { Customer } from "@/lib/types";

export async function createCustomerAction(id: string, input: db.CustomerInput): Promise<ActionResult<Customer>> {
  try {
    const { organizationId } = await requireSession();
    const customer = await db.createCustomer(organizationId, id, input);
    return { ok: true, data: customer };
  } catch {
    return { ok: false, error: "Couldn't save this customer." };
  }
}

export async function updateCustomerAction(id: string, input: db.CustomerInput): Promise<ActionResult<Customer>> {
  try {
    const { organizationId } = await requireSession();
    const customer = await db.updateCustomer(organizationId, id, input);
    if (!customer) return { ok: false, error: "Customer not found." };
    return { ok: true, data: customer };
  } catch {
    return { ok: false, error: "Couldn't update this customer." };
  }
}

export async function deleteCustomerAction(id: string): Promise<ActionResult<null>> {
  try {
    const { organizationId } = await requireSession();
    await db.deleteCustomer(organizationId, id);
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: "Couldn't delete this customer." };
  }
}
